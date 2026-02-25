import { toast } from '../components/Toast';

const WEB3_STORAGE_UPLOAD_URL = 'https://api.web3.storage/upload';

export const uploadImageToIpfs = async (file: File): Promise<string> => {
  const token = import.meta.env.VITE_WEB3_STORAGE_TOKEN;

  if (!token) {
    throw new Error(
      'IPFS_UPLOAD_NOT_CONFIGURED: Set VITE_WEB3_STORAGE_TOKEN in your env to enable image uploads.'
    );
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(WEB3_STORAGE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    let details = '';
    try {
      const data = await res.json();
      details = data?.message || data?.error || res.statusText;
    } catch {
      details = res.statusText;
    }
    throw new Error(`IPFS_UPLOAD_FAILED: ${details}`);
  }

  const data = await res.json().catch(() => null);
  const cid = data?.cid || data?.value?.cid;
  if (!cid || typeof cid !== 'string') {
    throw new Error('IPFS_UPLOAD_FAILED: Missing CID in response.');
  }


  // Return canonical ipfs:// URL; frontends can choose their preferred gateway.
  return `ipfs://${cid}`;
};

export const ensureIpfsUploadConfigured = () => {
  if (!import.meta.env.VITE_WEB3_STORAGE_TOKEN) {
    toast.error(
      'IPFS upload not configured. Set VITE_WEB3_STORAGE_TOKEN to enable image hosting, or paste an image URL instead.'
    );
    return false;
  }
  return true;
};
