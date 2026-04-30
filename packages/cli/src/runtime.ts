export function shouldRequireAPIKey(args: string[]) {
  const command = args[0];
  return Boolean(command && command !== "--help" && command !== "-h" && command !== "help");
}
