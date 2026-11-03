export interface AccountProfile { fullName: string; storeName: string }

export function parseAccountProfile(value: unknown): AccountProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter your full name and store name.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => key !== "fullName" && key !== "storeName")) throw new Error("Unexpected profile fields.");
  const name = (value: unknown, label: string) => {
    if (typeof value !== "string" || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error(`Enter a valid ${label}.`);
    const result = value.trim().replace(/\s+/g, " ");
    if (result.length < 2 || result.length > 100) throw new Error(`${label} must be between 2 and 100 characters.`);
    return result;
  };
  return { fullName: name(data.fullName, "Full name"), storeName: name(data.storeName, "Store name") };
}
