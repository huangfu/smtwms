import net from 'node:net';

function formatTcpPrintError(host: string, port: number, err: unknown): string {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === 'ECONNREFUSED') {
    return `无法连接 Zebra 打印机 (${host}:${port})：端口拒绝连接。请确认打印机已开机、端口为 9100，且打印服务器与打印机处于同一局域网。`;
  }
  if (code === 'ETIMEDOUT' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return `连接 Zebra 打印机 (${host}:${port}) 超时或网络不可达。若 WMS 部署在云端且无法直连车间内网 IP，请切换为本机「USB / Zebra Browser Print」模式或下载 .zpl 文件。`;
  }
  if (code === 'ENOTFOUND') {
    return `无法解析打印机主机名 "${host}"，请检查 IP 地址或局域网 DNS。`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return `Zebra TCP 通信失败 (${host}:${port})：${msg}`;
}

export function testZebraTcpConnection(
  host: string,
  port: number,
  timeoutMs = 3000
): Promise<{ latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let settled = false;
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) {
        reject(new Error(formatTcpPrintError(host, port, err)));
      } else {
        resolve({ latencyMs: Date.now() - start });
      }
    };

    socket.once('connect', () => finish());
    socket.once('timeout', () => {
      const e = new Error('连接超时') as NodeJS.ErrnoException;
      e.code = 'ETIMEDOUT';
      finish(e);
    });
    socket.once('error', (err) => finish(err));
  });
}

export function sendZebraTcpZpl(
  host: string,
  port: number,
  zpl: string,
  timeoutMs = 4500
): Promise<{ bytesSent: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const payload = Buffer.from(zpl, 'utf8');
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(formatTcpPrintError(host, port, err)));
    };

    socket.once('connect', () => {
      socket.write(payload, (writeErr) => {
        if (writeErr) {
          fail(writeErr);
          return;
        }
        socket.end(() => {
          if (settled) return;
          settled = true;
          resolve({ bytesSent: payload.byteLength });
        });
      });
    });

    socket.once('timeout', () => {
      const e = new Error('发送超时') as NodeJS.ErrnoException;
      e.code = 'ETIMEDOUT';
      fail(e);
    });
    socket.once('error', fail);
  });
}
