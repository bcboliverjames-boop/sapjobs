import { createSSRApp } from "vue";
import App from "./App.vue";
// import { initCloudBase } from "./utils/cloudbase";
import showCaptcha from "./components/show-captcha.vue";
import UniIcons from "@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue";

export function createApp() {
  const app = createSSRApp(App);

  app.component("show-captcha", showCaptcha);
  app.component("uni-icons", UniIcons as any);
  
  return {
    app,
  };
}
