import createSubcommandRouter from "@tokenring-ai/agent/util/subcommandRouter";
import defaultAction from "./settings/default.ts";
import disable from "./settings/disable.ts";
import enable from "./settings/enable.ts";
import select from "./settings/select.ts";
import set from "./settings/set.ts";
import show from "./settings/show.ts";

export default createSubcommandRouter({
  show,
  set,
  select,
  enable,
  disable,
  default: defaultAction,
});