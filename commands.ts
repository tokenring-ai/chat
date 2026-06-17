import chatCompact from "./commands/chat/compact.ts";
import chatContext from "./commands/chat/context.ts";
import modelGet from "./commands/chat/model/get.ts";
import modelReset from "./commands/chat/model/reset.ts";
import modelSelect from "./commands/chat/model/select.ts";
import modelSet from "./commands/chat/model/set.ts";
import modelSettingsDisable from "./commands/chat/model/settings/disable.ts";
import modelSettingsEnable from "./commands/chat/model/settings/enable.ts";
import modelSettingsSelect from "./commands/chat/model/settings/select.ts";
import modelSettingsSet from "./commands/chat/model/settings/set.ts";
import modelSettingsShow from "./commands/chat/model/settings/show.ts";
import chatReset from "./commands/chat/reset.ts";
import chatSend from "./commands/chat/send.ts";
import toolDisable from "./commands/tool/disable.ts";
import toolEnable from "./commands/tool/enable.ts";
import toolHide from "./commands/tool/hide.ts";
import toolList from "./commands/tool/list.ts";
import toolSelect from "./commands/tool/select.ts";
import toolSet from "./commands/tool/set.ts";

export default [
  // Chat commands
  chatSend,
  chatContext,
  chatCompact,
  chatReset,

  // Model commands
  modelGet,
  modelSet,
  modelSelect,
  modelReset,
  modelSettingsShow,
  modelSettingsSet,
  modelSettingsSelect,
  modelSettingsEnable,
  modelSettingsDisable,

  // Tool commands
  toolList,
  toolEnable,
  toolDisable,
  toolSet,
  toolSelect,
  toolHide,
];
