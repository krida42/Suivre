type MutationCallbacks<TResult> = {
  onSuccess: (result: TResult) => void;
  onError: (error: unknown) => void;
};

export function mutateAsync<TVariables, TResult>(
  mutate: (variables: TVariables, callbacks: MutationCallbacks<TResult>) => void,
  variables: TVariables
): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    mutate(variables, {
      onSuccess: (result) => resolve(result),
      onError: (error) => reject(error instanceof Error ? error : new Error("Wallet mutation failed")),
    });
  });
}
