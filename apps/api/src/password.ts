import { hash, type Options, verify } from '@node-rs/argon2';

const options: Options = {
  algorithm: 2,
  memoryCost: 65_536,
  outputLen: 32,
  parallelism: 1,
  timeCost: 3,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(input: { hash: string; password: string }): Promise<boolean> {
  try {
    return await verify(input.hash, input.password, options);
  } catch {
    return false;
  }
}
