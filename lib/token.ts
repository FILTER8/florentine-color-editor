import { createPublicClient, http, type Address } from 'viem';
import { mainnet } from 'viem/chains';

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  '0x31bbc8Af58717059A356fdeF3d4B04160906FEB1') as Address;

export const tokenAbi = [
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }]
  }
] as const;

export type TokenMetadata = {
  name?: string;
  description?: string;
  image: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  [key: string]: unknown;
};

export async function fetchTokenMetadata(tokenId: bigint): Promise<TokenMetadata> {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://eth.llamarpc.com';
  const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });

  const uri = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: tokenAbi,
    functionName: 'tokenURI',
    args: [tokenId]
  });

  if (!uri.startsWith('data:application/json') && !uri.trim().startsWith('{')) {
    throw new Error(`Unsupported tokenURI format: ${uri.slice(0, 80)}...`);
  }

  const json = uri.trim().startsWith('{')
    ? uri
    : decodeURIComponent(uri.split(',')[1] || '');

  const metadata = JSON.parse(json) as TokenMetadata;
  if (!metadata.image?.startsWith('data:image/')) {
    throw new Error('Metadata did not contain a data:image image field.');
  }
  return metadata;
}
