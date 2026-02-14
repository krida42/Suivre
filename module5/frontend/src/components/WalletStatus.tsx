import { useSuiClientQuery } from "@mysten/dapp-kit";
import { Flex, Text, Card } from "@radix-ui/themes";
import { useEnokiAuth } from "../context/EnokiAuthContext";

export function WalletStatus() {
  const { accountAddress } = useEnokiAuth();

  const { data: balance } = useSuiClientQuery(
    "getBalance",
    {
      owner: accountAddress as string,
    },
    {
      enabled: !!accountAddress,
    }
  );

  if (!accountAddress) {
    return (
      <Card>
        <Text>Please connect your wallet to continue</Text>
      </Card>
    );
  }

  return (
    <Card>
      <Flex direction="column" gap="2">
        <Text size="4" weight="bold">Wallet Status</Text>
        <Text>Address: {accountAddress}</Text>
        <Text>
          Balance: {balance ? Number(balance.totalBalance) / 1_000_000_000 : "Loading..."} SUI
        </Text>
      </Flex>
    </Card>
  );
}
