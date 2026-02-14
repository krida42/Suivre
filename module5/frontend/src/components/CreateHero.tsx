import { useSuiClient } from "@mysten/dapp-kit";
import { Flex, Heading, Text, Card, Button, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { useNetworkVariable } from "../networkConfig";
import { RefreshProps } from "../types/props";
import { useEnokiAuth } from "../context/EnokiAuthContext";
import { buildCreateHeroTransaction } from "../utils/transactions";
import { sponsorAndExecuteTransaction } from "../utils/sponsoredTransactions";

export function CreateHero({ setRefreshKey }: RefreshProps) {
  const { accountAddress, signSponsoredTransaction, isSigning } = useEnokiAuth();
  const packageId = useNetworkVariable("packageId");
  const suiClient = useSuiClient();

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [power, setPower] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateHero = async () => {
    if (!accountAddress || !packageId || !name.trim() || !imageUrl.trim() || !power.trim()) return;
    
    setIsCreating(true);
    
    try {
      const tx = buildCreateHeroTransaction(packageId, name, imageUrl, power, accountAddress);

      await sponsorAndExecuteTransaction({
        transaction: tx,
        client: suiClient,
        sender: accountAddress,
        signSponsoredTransaction,
        allowedMoveCallTargets: [`${packageId}::hero::create_hero`],
      });
      
      console.log("Hero created successfully!");
      setName("");
      setImageUrl("");
      setPower("");
      setRefreshKey(Date.now());
    } catch (error) {
      console.error("Error creating hero:", error);
      alert("Failed to create hero: " + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const isFormValid = name.trim() && imageUrl.trim() && power.trim() && Number(power) > 0;

  if (!accountAddress) {
    return (
      <Card>
        <Text>Please connect your wallet to create heroes</Text>
      </Card>
    );
  }

  return (
    <Card style={{ padding: "20px" }}>
      <Flex direction="column" gap="4">
        <Heading size="6">Create New Hero</Heading>
        
        <Flex direction="column" gap="3">
          <Flex direction="column" gap="2">
            <Text size="3" weight="medium">Hero Name</Text>
            <TextField.Root
              placeholder="Enter hero name (e.g., Fire Dragon)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text size="3" weight="medium">Image URL</Text>
            <TextField.Root
              placeholder="Enter image URL (e.g., https://example.com/hero.jpg)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text size="3" weight="medium">Power Level</Text>
            <TextField.Root
              placeholder="Enter power level (e.g., 100)"
              type="number"
              min="1"
              value={power}
              onChange={(e) => setPower(e.target.value)}
            />
          </Flex>

          <Button 
            onClick={handleCreateHero}
            disabled={!isFormValid || isCreating || isSigning}
            size="3"
            loading={isCreating}
            style={{ marginTop: "8px" }}
          >
            {isCreating ? "Creating Hero..." : "Create Hero"}
          </Button>
        </Flex>

        {/* Preview */}
        {name && imageUrl && power && (
          <Card style={{ padding: "16px", background: "var(--gray-a2)" }}>
            <Flex direction="column" gap="2">
              <Text size="3" weight="medium" color="gray">Preview:</Text>
              <Text size="4">{name} (Power: {power})</Text>
              {imageUrl && (
                <img 
                  src={imageUrl} 
                  alt={name}
                  style={{ 
                    width: "120px", 
                    height: "80px", 
                    objectFit: "cover", 
                    borderRadius: "6px" 
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </Flex>
          </Card>
        )}
      </Flex>
    </Card>
  );
}
