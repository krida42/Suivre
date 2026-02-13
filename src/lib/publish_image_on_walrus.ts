type WalrusService = {
  id: string;
  name: string;
  publisherUrl: string;
  aggregatorUrl: string;
};

const services: WalrusService[] = [
  {
    id: "service1",
    name: "walrus.space",
    publisherUrl: "/publisher1",
    aggregatorUrl: "/aggregator1",
  },
  {
    id: "service2",
    name: "staketab.org",
    publisherUrl: "/publisher2",
    aggregatorUrl: "/aggregator2",
  },
  {
    id: "service3",
    name: "redundex.com",
    publisherUrl: "/publisher3",
    aggregatorUrl: "/aggregator3",
  },
  {
    id: "service4",
    name: "nodes.guru",
    publisherUrl: "/publisher4",
    aggregatorUrl: "/aggregator4",
  },
  {
    id: "service5",
    name: "banansen.dev",
    publisherUrl: "/publisher5",
    aggregatorUrl: "/aggregator5",
  },
  {
    id: "service6",
    name: "everstake.one",
    publisherUrl: "/publisher6",
    aggregatorUrl: "/aggregator6",
  },
];

function getPublisherUrl(path: string): string {
  const service = services.find((s) => s.id === "service1");
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\//, "");
  return `${service?.publisherUrl}/v1/${cleanPath}`;
}

export const publishImageOnWalrus = async (image: Uint8Array) => {
  const response = await fetch(`https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=${1}`, {
    method: "PUT",
    body: image,
  });
  if (!response.ok) {
    throw new Error(`Failed to publish image on Walrus: ${response.statusText}`);
  }
  return response.json();
};
