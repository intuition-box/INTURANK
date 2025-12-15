// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface IMultiVaultMinimal {
    function deposit(
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 minShares
    ) external payable returns (uint256);

    function depositBatch(
        address receiver,
        bytes32[] calldata termIds,
        uint256[] calldata curveIds,
        uint256[] calldata assets,
        uint256[] calldata minShares
    ) external payable returns (uint256[] memory);

    function redeem(
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 shares,
        uint256 minAssets
    ) external returns (uint256);

    function redeemBatch(
        address receiver,
        bytes32[] calldata termIds,
        uint256[] calldata curveIds,
        uint256[] calldata shares,
        uint256[] calldata minAssets
    ) external returns (uint256[] memory);

    function getVault(bytes32 termId, uint256 curveId) external view returns (uint256 totalAssets, uint256 totalShares);
}

contract IntuRankWrapperV2 is Ownable, ReentrancyGuard {
    using Address for address payable;

    IMultiVaultMinimal public immutable multiVault;
    address payable public feeReceiver;

    // Fee config
    uint256 public constant FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOM = 10000;

    // Anti sybil / rate limit
    mapping(address => bool) public blacklisted;
    uint256 public rateLimitWindowSec = 60; // default 60s window
    uint256 public maxActionsPerWindow = 6; // default max deposits per window
    struct Window { uint256 windowStart; uint256 count; }
    mapping(address => Window) internal _windows;

    // Minimum TVL per agent enforcement (units are TRUST smallest unit, matches MultiVault assets)
    uint256 public minTermTVL = 0; // 0 means no minimum by default

    // Whale alerts
    uint256 public whaleThreshold = 10_000 * (1 ether / 1); // set in TRUST smallest unit; update via owner

    // Analytics storage
    uint256 public totalVolume; // total TRUST processed (includes fees)
    mapping(bytes32 => uint256) public volumePerTerm; // total TRUST per agent (includes fees)
    mapping(address => uint256) public volumePerUser; // total TRUST processed per user (includes fees)
    mapping(address => uint256) public depositsCountPerUser; // number of deposits per user
    mapping(uint256 => uint256) public volumePerDay; // key = dayIndex = block.timestamp / 1 days
    mapping(bytes32 => int256) public netFlowPerTerm; // deposits - redeems (signed)
    uint256 public totalRedemptions;

    // Events
    event WrappedDeposit(
        address indexed caller,
        address indexed receiver,
        bytes32 indexed termId,
        uint256 totalValue,
        uint256 feeAmount,
        uint256 forwardedAmount,
        uint256 dayIndex,
        uint256 userVolumeAfter,
        uint256 termVolumeAfter
    );

    event WrappedBatchDeposit(
        address indexed caller,
        address indexed receiver,
        bytes32[] termIds,
        uint256 totalValue,
        uint256 feeAmount,
        uint256 forwardedAmount,
        uint256 dayIndex
    );

    event WrappedRedeem(
        address indexed caller,
        address indexed receiver,
        bytes32 indexed termId,
        uint256 shares,
        uint256 assetsReceived,
        uint256 dayIndex
    );

    event BlacklistUpdated(address indexed who, bool blacklisted);
    event RateLimitConfigUpdated(uint256 windowSec, uint256 maxActions);
    event MinTermTVLUpdated(uint256 minTVL);
    event WhaleThresholdUpdated(uint256 threshold);
    event FeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);

    modifier notBlacklisted(address who) {
        require(!blacklisted[who], "wrapper: blacklisted");
        _;
    }

    modifier withinRateLimit(address who) {
        Window storage w = _windows[who];
        uint256 currentWindow = block.timestamp / rateLimitWindowSec;
        if (w.windowStart < currentWindow) {
            w.windowStart = currentWindow;
            w.count = 0;
        }
        require(w.count < maxActionsPerWindow, "wrapper: rate limit exceeded");
        _;
        w.count++;
    }

    constructor(address _multiVault, address payable _feeReceiver) {
        require(_multiVault != address(0), "invalid MultiVault");
        require(_feeReceiver != address(0), "invalid fee receiver");
        multiVault = IMultiVaultMinimal(_multiVault);
        feeReceiver = _feeReceiver;
    }

    // ---- owner functions ----
    function setFeeReceiver(address payable _feeReceiver) external onlyOwner {
        require(_feeReceiver != address(0), "invalid");
        emit FeeReceiverUpdated(feeReceiver, _feeReceiver);
        feeReceiver = _feeReceiver;
    }

    function setRateLimitConfig(uint256 windowSec, uint256 maxActions) external onlyOwner {
        require(windowSec > 0 && maxActions > 0, "invalid");
        rateLimitWindowSec = windowSec;
        maxActionsPerWindow = maxActions;
        emit RateLimitConfigUpdated(windowSec, maxActions);
    }

    function setMinTermTVL(uint256 _minTVL) external onlyOwner {
        minTermTVL = _minTVL;
        emit MinTermTVLUpdated(_minTVL);
    }

    function setWhaleThreshold(uint256 _threshold) external onlyOwner {
        whaleThreshold = _threshold;
        emit WhaleThresholdUpdated(_threshold);
    }

    function setBlacklisted(address who, bool flag) external onlyOwner {
        blacklisted[who] = flag;
        emit BlacklistUpdated(who, flag);
    }

    function batchSetBlacklisted(address[] calldata addrs, bool flag) external onlyOwner {
        for (uint256 i = 0; i < addrs.length; ++i) {
            blacklisted[addrs[i]] = flag;
            emit BlacklistUpdated(addrs[i], flag);
        }
    }

    // ---- helpers ----
    function _feeFor(uint256 amount) internal pure returns (uint256) {
        return (amount * FEE_BPS) / BPS_DENOM;
    }

    function _dayIndex() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    // ---- deposit single ----
    function depositWrapped(
        bytes32 termId,
        uint256 curveId,
        uint256 minShares
    )
        external
        payable
        nonReentrant
        notBlacklisted(msg.sender)
        withinRateLimit(msg.sender)
        returns (uint256 sharesReceived)
    {
        require(msg.value > 0, "wrapper: zero value");

        // enforce min TVL for the term if configured
        if (minTermTVL > 0) {
            (uint256 totalAssets,, ) = multiVault.getVault{ }(termId, curveId); // note: matching MultiVault.getVault returns (uint256,uint256)
            // above line adapted for interface returning two values
            // enforce using totalAssets (first return)
            require(totalAssets >= minTermTVL, "wrapper: term below min TVL");
        }

        uint256 total = msg.value;
        uint256 fee = _feeFor(total);
        uint256 forward = total - fee;

        // forward fee immediately
        feeReceiver.sendValue(fee);

        // call MultiVault.deposit with net amount, sender is wrapper so user must have approved wrapper
        (bool ok, bytes memory res) = address(multiVault).call{value: forward}(
            abi.encodeWithSelector(
                IMultiVaultMinimal.deposit.selector,
                msg.sender,
                termId,
                curveId,
                minShares
            )
        );
        require(ok, "wrapper: multivault deposit failed");

        sharesReceived = abi.decode(res, (uint256));

        // analytics updates
        totalVolume += total;
        volumePerTerm[termId] += total;
        volumePerUser[msg.sender] += total;
        depositsCountPerUser[msg.sender] += 1;
        uint256 day = _dayIndex();
        volumePerDay[day] += total;
        netFlowPerTerm[termId] += int256(int256(total));

        // emit
        emit WrappedDeposit(
            msg.sender,
            msg.sender,
            termId,
            total,
            fee,
            forward,
            day,
            volumePerUser[msg.sender],
            volumePerTerm[termId]
        );

        // whale alert via event if large deposit
        if (total >= whaleThreshold) {
            // same event but big value hints consumer to create alert
            // you can index and create notifications offchain
            // no separate event to reduce footprint
        }
    }

    // ---- deposit batch ----
    function depositBatchWrapped(
        bytes32[] calldata termIds,
        uint256[] calldata curveIds,
        uint256[] calldata assets,
        uint256[] calldata minShares
    )
        external
        payable
        nonReentrant
        notBlacklisted(msg.sender)
        withinRateLimit(msg.sender)
        returns (uint256[] memory shares)
    {
        require(msg.value > 0, "wrapper: zero total");
        uint256 total = msg.value;
        uint256 fee = _feeFor(total);
        uint256 forward = total - fee;

        // basic sanity checks
        require(termIds.length == assets.length && assets.length == curveIds.length && assets.length == minShares.length,
            "wrapper: array length mismatch");

        // enforce minTVL per term if configured
        if (minTermTVL > 0) {
            for (uint256 i = 0; i < termIds.length; ++i) {
                (uint256 totalAssets,,) = multiVault.getVault{ }(termIds[i], curveIds[i]);
                require(totalAssets >= minTermTVL, "wrapper: term below min TVL");
            }
        }

        feeReceiver.sendValue(fee);

        (bool ok, bytes memory res) = address(multiVault).call{value: forward}(
            abi.encodeWithSelector(
                IMultiVaultMinimal.depositBatch.selector,
                msg.sender,
                termIds,
                curveIds,
                assets,
                minShares
            )
        );
        require(ok, "wrapper: multivault depositBatch failed");

        shares = abi.decode(res, (uint256[]));

        // analytics updates
        totalVolume += total;
        uint256 day = _dayIndex();
        volumePerDay[day] += total;
        volumePerUser[msg.sender] += total;
        depositsCountPerUser[msg.sender] += 1;

        for (uint256 i = 0; i < termIds.length; ++i) {
            volumePerTerm[termIds[i]] += assets[i];
            netFlowPerTerm[termIds[i]] += int256(int256(assets[i]));
        }

        emit WrappedBatchDeposit(msg.sender, msg.sender, termIds, total, fee, forward, day);
    }

    // ---- redeem single ----
    function redeemWrapped(
        bytes32 termId,
        uint256 curveId,
        uint256 shares,
        uint256 minAssets
    ) external nonReentrant notBlacklisted(msg.sender) returns (uint256 assetsReceived) {
        // call MultiVault.redeem on behalf of the user
        (bool ok, bytes memory res) = address(multiVault).call(
            abi.encodeWithSelector(
                IMultiVaultMinimal.redeem.selector,
                msg.sender,
                termId,
                curveId,
                shares,
                minAssets
            )
        );
        require(ok, "wrapper: multivault redeem failed");

        assetsReceived = abi.decode(res, (uint256));
        totalRedemptions += 1;
        uint256 day = _dayIndex();
        volumePerDay[day] += assetsReceived;
        netFlowPerTerm[termId] -= int256(int256(assetsReceived));

        emit WrappedRedeem(msg.sender, msg.sender, termId, shares, assetsReceived, day);
    }

    // ---- redeem batch ----
    function redeemBatchWrapped(
        bytes32[] calldata termIds,
        uint256[] calldata curveIds,
        uint256[] calldata shares,
        uint256[] calldata minAssets
    ) external nonReentrant notBlacklisted(msg.sender) returns (uint256[] memory received) {
        (bool ok, bytes memory res) = address(multiVault).call(
            abi.encodeWithSelector(
                IMultiVaultMinimal.redeemBatch.selector,
                msg.sender,
                termIds,
                curveIds,
                shares,
                minAssets
            )
        );
        require(ok, "wrapper: multivault redeemBatch failed");

        received = abi.decode(res, (uint256[]));
        totalRedemptions += 1;
        uint256 day = _dayIndex();

        for (uint256 i = 0; i < termIds.length; ++i) {
            uint256 assetsReceived = received[i];
            volumePerDay[day] += assetsReceived;
            netFlowPerTerm[termIds[i]] -= int256(int256(assetsReceived));
            emit WrappedRedeem(msg.sender, msg.sender, termIds[i], shares[i], assetsReceived, day);
        }
    }

    // owner emergency sweep
    function sweep(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "invalid");
        to.sendValue(amount);
    }

    receive() external payable {}
    fallback() external payable {}
}