const PREFIX = "MISSING_CREDENTIAL_";

function envName(key: string): string {
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(key)) throw new Error(`Invalid credential key: ${key}`);
  return `${PREFIX}${key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

export function credentialValue(key: string): string | null {
  const value = process.env[envName(key)]?.trim();
  return value || null;
}

export function credentialAvailable(key: string): boolean {
  return credentialValue(key) !== null;
}

export function credentialEnvironmentName(key: string): string {
  return envName(key);
}
