import { createApp } from "./app";
import { env } from "./config/env";

createApp().listen(env.PORT, () => {
  console.log(JSON.stringify({ level: "info", msg: "api listening", port: env.PORT }));
});
