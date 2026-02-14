import { Button, Flex, Text } from "@radix-ui/themes";
import { useEnokiAuth } from "../context/EnokiAuthContext";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function EnokiLoginButton() {
  const { accountAddress, isAuthLoading, loginWithGoogle, logout } = useEnokiAuth();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Google zkLogin failed:", error);
      alert("Login failed: " + (error as Error).message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      console.log("Wallet disconnected");
    } catch (error) {
      console.error("Disconnect failed:", error);
    }
  };

  if (accountAddress) {
    return (
      <Flex align="center" gap="2">
        <Text size="2" color="green">
          {"\u2713"} Connected via Google zkLogin ({shortenAddress(accountAddress)})
        </Text>
        <Button onClick={handleDisconnect} variant="soft" color="red" size="1">
          Disconnect
        </Button>
      </Flex>
    );
  }

  return (
    <Flex gap="2">
      <Button onClick={handleGoogleLogin} variant="solid" color="blue" disabled={isAuthLoading}>
        {isAuthLoading ? "Signing in..." : "Sign in with Google zkLogin"}
      </Button>
    </Flex>
  );
}
