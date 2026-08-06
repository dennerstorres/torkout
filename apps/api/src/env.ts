import { z } from 'zod';

const environmentSchema = z
  .strictObject({
    /**
     * Camada REST somente leitura de `/api/ai`, usada por GPT Actions. Só existe quando
     * `MCP_ENABLED` é `true`, porque depende do mesmo servidor OAuth, do mesmo escopo e da mesma
     * camada de consulta. O padrão é ligada: quem habilitou a integração já consentiu com a leitura;
     * a variável existe como desligamento seletivo, para manter o MCP sem expor o REST.
     */
    AI_REST_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    AUTH_BASE_URL: z
      .url()
      .refine((value) => value.startsWith('https://') || value.startsWith('http://localhost')),
    AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
    HOST: z.string().min(1).default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /**
     * Integração MCP somente leitura. O padrão é desligado: uma instância só passa a aceitar
     * clientes externos quando o titular decide isso explicitamente. Só o valor `true` habilita.
     */
    MCP_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    /**
     * URL pública sob a qual o MCP e o servidor OAuth são alcançados. Ausente, usa `AUTH_BASE_URL`;
     * um subdomínio dedicado como `https://mcp.exemplo.com` também é válido. O domínio real nunca
     * fica no código.
     */
    MCP_PUBLIC_URL: z
      .url()
      .refine((value) => value.startsWith('https://') || value.startsWith('http://localhost'))
      .optional(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Diretório do driver local de armazenamento de objetos; use um volume persistente. */
    OBJECT_STORAGE_DIR: z.string().min(1).default('./var/object-storage'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    /**
     * Cadastro público. O padrão é fechado: a instância de referência é pessoal e não opera como
     * controladora de dados de saúde de terceiros. Uma instância auto-hospedada pode habilitá-lo
     * assumindo essa responsabilidade. Só o valor `true` abre; qualquer outro texto é recusado em
     * vez de ser interpretado como verdadeiro.
     */
    PUBLIC_SIGNUP_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_FROM: z.string().min(3),
    SMTP_HOST: z.string().min(1),
    SMTP_PASSWORD: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
    SMTP_SECURE: z.enum(['true', 'false']).transform((value) => value === 'true'),
    SMTP_USER: z.string().min(1),
    TRUST_PROXY: z
      .string()
      .default('127.0.0.1,::1')
      .transform((value) => value.split(',').map((entry) => entry.trim()))
      .pipe(z.array(z.string().min(1)).min(1)),
    TRUSTED_ORIGINS: z
      .string()
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(z.array(z.url()).min(1)),
  })
  .refine(
    (environment) =>
      environment.TRUSTED_ORIGINS.includes(new URL(environment.AUTH_BASE_URL).origin),
    { message: 'AUTH_BASE_URL must be included in TRUSTED_ORIGINS', path: ['TRUSTED_ORIGINS'] },
  );

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(
  input: Record<string, string | undefined> = process.env,
): Environment {
  return environmentSchema.parse({
    AI_REST_ENABLED: input.AI_REST_ENABLED,
    AUTH_BASE_URL: input.AUTH_BASE_URL,
    AUTH_SECRET: input.AUTH_SECRET,
    DATABASE_URL: input.DATABASE_URL,
    HOST: input.HOST,
    LOG_LEVEL: input.LOG_LEVEL,
    MCP_ENABLED: input.MCP_ENABLED,
    // Uma variável declarada e deixada em branco no `.env` significa "não configurada"; sem esta
    // normalização, a string vazia seria validada como URL e derrubaria a subida do processo.
    MCP_PUBLIC_URL: input.MCP_PUBLIC_URL === '' ? undefined : input.MCP_PUBLIC_URL,
    NODE_ENV: input.NODE_ENV,
    OBJECT_STORAGE_DIR: input.OBJECT_STORAGE_DIR,
    PORT: input.PORT,
    PUBLIC_SIGNUP_ENABLED: input.PUBLIC_SIGNUP_ENABLED,
    SMTP_FROM: input.SMTP_FROM,
    SMTP_HOST: input.SMTP_HOST,
    SMTP_PASSWORD: input.SMTP_PASSWORD,
    SMTP_PORT: input.SMTP_PORT,
    SMTP_SECURE: input.SMTP_SECURE,
    SMTP_USER: input.SMTP_USER,
    TRUST_PROXY: input.TRUST_PROXY,
    TRUSTED_ORIGINS: input.TRUSTED_ORIGINS,
  });
}
