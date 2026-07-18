import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "AgriAI",
  version: packageJson.version,
  copyright: `© ${currentYear}, AgriAI.`,
  meta: {
    title: "AgriAI - Nền tảng quản lý nông nghiệp thông minh",
    description:
      "AgriAI là nền tảng số hóa quản lý thửa đất, cây trồng và dự báo nông nghiệp thông minh cho tỉnh Điện Biên.",
  },
};
