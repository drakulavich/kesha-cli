import pc from "picocolors";

export const log = {
  info: (msg: string) => console.log(msg),
  success: (msg: string) => console.log(pc.green(msg)),
  progress: (msg: string) => console.log(pc.cyan(msg)),
  warn: (msg: string) => console.error(pc.yellow(msg)),
  error: (msg: string) => console.error(pc.red(msg)),
};
