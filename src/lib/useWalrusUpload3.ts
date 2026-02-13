// Step 1: Create and encode the flow (can be done immediately when file is selected)
const flow = client.walrus.writeFilesFlow({
  files: [
    WalrusFile.from({
      contents: new Uint8Array(fileData),
      identifier: "my-file.txt",
    }),
  ],
});
await flow.encode();
// Step 2: Register the blob (triggered by user clicking a register button after the encode step)
async function handleRegister() {
  const registerTx = flow.register({
    epochs: 3,
    owner: currentAccount.address,
    deletable: true,
  });
  const { digest } = await signAndExecuteTransaction({ transaction: registerTx });
  // Step 3: Upload the data to storage nodes
  // This can be done immediately after the register step, or as a separate step the user initiates
  await flow.upload({ digest });
}
// Step 4: Certify the blob (triggered by user clicking a certify button after the blob is uploaded)
async function handleCertify() {
  const certifyTx = flow.certify();
  await signAndExecuteTransaction({ transaction: certifyTx });
  // Step 5: Get the new files
  const files = await flow.listFiles();
  console.log("Uploaded files", files);
}
