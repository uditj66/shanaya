// Gift card codes and private link tokens.
import { randomBytes, randomInt } from "node:crypto";

// No 0/O or 1/I, so codes read cleanly over the phone and at the desk.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const chunk = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const giftCardCode = (brandName: string) => {
  const prefix = brandName.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "GFT";
  return `${prefix}-${chunk(4)}-${chunk(4)}`;
};
export const viewToken = () => randomBytes(18).toString("base64url");
