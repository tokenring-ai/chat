import chatContext from './commands/chat/context.ts';
import chatSend from './commands/chat/send.ts';
import chatCompact from './commands/chat/compact.ts';
import chatReset from './commands/chat/reset.ts';
import modelGet from './commands/model/get.ts';
import modelReset from './commands/model/reset.ts';
import modelSelect from './commands/model/select.ts';
import modelSet from './commands/model/set.ts';
import modelSettingsDisable from './commands/model/settings/disable.ts';
import modelSettingsEnable from './commands/model/settings/enable.ts';
import modelSettingsSelect from './commands/model/settings/select.ts';
import modelSettingsSet from './commands/model/settings/set.ts';
import modelSettingsShow from './commands/model/settings/show.ts';
import toolDisable from './commands/tool/disable.ts';
import toolEnable from './commands/tool/enable.ts';
import toolList from './commands/tool/list.ts';
import toolSelect from './commands/tool/select.ts';
import toolSet from './commands/tool/set.ts';

export default [
  chatSend, chatContext, chatCompact, chatReset,
  modelGet, modelSet, modelSelect, modelReset,
  modelSettingsShow, modelSettingsSet, modelSettingsSelect, modelSettingsEnable, modelSettingsDisable,
  toolList, toolEnable, toolDisable, toolSet, toolSelect,
];
