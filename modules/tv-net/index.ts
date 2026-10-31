import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export type TcpOpenOptions = {
  host: string;
  port: number;
  tls?: boolean;
  /** Base64 PKCS#12 holding the client certificate + key (Android TV pairing). */
  clientP12?: string;
  p12Password?: string;
  timeoutMs?: number;
};

type TvNetNative = {
  tcpOpen(opts: TcpOpenOptions): Promise<{ id: string; peerCert?: string | null }>;
  tcpWrite(id: string, base64: string): Promise<void>;
  tcpClose(id: string): Promise<void>;
  closeAll(): Promise<void>;
  scan(opts: { hosts: string[]; ports: number[]; timeoutMs?: number; concurrency?: number }): Promise<{
    open: { host: string; port: number }[];
    denied: boolean;
  }>;
  udp(opts: { host: string; port: number; data: string; timeoutMs?: number; maxReplies?: number }): Promise<{
    replies: string[];
    error?: string | null;
  }>;
  mdns(opts: { type: string; timeoutMs?: number }): Promise<{
    services: { name: string; host: string; port: number; txt: Record<string, string> }[];
    error?: string | null;
  }>;
  addListener(event: 'onTcpData', cb: (e: { id: string; data: string }) => void): EventSubscription;
  addListener(event: 'onTcpClose', cb: (e: { id: string; error?: string | null }) => void): EventSubscription;
};

/** Null in builds without the module (Expo Go, web). */
export const TvNet = requireOptionalNativeModule<TvNetNative>('TvNet');
