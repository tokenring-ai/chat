import ChatService from "../ChatService.js";
import HumanInterfaceService from "../HumanInterfaceService.js";

/**
 * Usage:
 *   /tools [enable|disable|set] <tool1> <tool2> ...
 *   /tools                 - shows interactive tool selection
 *   /tools enable foo bar  - enables foo and bar
 *   /tools disable baz     - disables baz
 *   /tools set a b c       - sets enabled tools to a, b, c
 */

export const description =
	"/tools [enable|disable|set] <tool1> <tool2> ... - List, enable, disable, or set enabled tools for the chat session.";

export async function execute(remainder, registry) {
	const chatService = registry.requireFirstServiceByType(ChatService);
	const humanInterfaceService = registry.getFirstServiceByType(
		HumanInterfaceService,
	);

	const availableTools = registry.tools.getAvailableToolNames();
	const activeTools = registry.tools.getEnabledToolNames();

	// Handle direct tool operations, e.g. /tools enable foo bar
	const directOperation = remainder?.trim();
	if (directOperation) {
		const parts = directOperation.split(/\s+/);
		const operation = parts[0];
		const toolNames = parts.slice(1);

		if (!["enable", "disable", "set"].includes(operation)) {
			chatService.errorLine(
				"Unknown operation. Usage: /tools [enable|disable|set] <tool1> <tool2> ...",
			);
			return;
		}

		// Validate tool names
		for (const name of toolNames) {
			if (!availableTools.includes(name)) {
				chatService.errorLine(`Unknown tool: ${name}`);
				return;
			}
		}

		switch (operation) {
			case "enable": {
				let changed = false;
				for (const name of toolNames) {
					if (activeTools.includes(name)) {
						chatService.systemLine(`Tool '${name}' is already enabled.`);
					} else if (availableTools.includes(name)) {
						await registry.tools.enableTools(name);
						changed = true;
						chatService.systemLine(`Enabled tool: ${name}`);
					} else {
						chatService.errorLine(`Unknown tool: ${name}`);
					}
				}
				if (!changed) chatService.systemLine("No tools were enabled.");
				break;
			}
			case "disable": {
				let changed = false;
				for (const name of toolNames) {
					if (activeTools.includes(name)) {
						await registry.tools.disableTools(name);
						changed = true;
						chatService.systemLine(`Disabled tool: ${name}`);
					} else {
						chatService.systemLine(`Tool '${name}' was not enabled.`);
					}
				}
				if (!changed) chatService.systemLine("No tools were disabled.");
				break;
			}
			case "set": {
				await registry.tools.setEnabledTools(...toolNames);
				chatService.systemLine(`Set enabled tools: ${toolNames.join(" ")}`);
				break;
			}
		}

		chatService.systemLine(
			"Current enabled tools: " +
				(registry.tools.getEnabledToolNames().join(" ") || "none"),
		);
		return;
	}

	// If no remainder provided, show interactive tree selection grouped by package
	const toolsByPackage = registry.tools.getToolsByPackage();

	// Build tree structure for tool selection
	const buildToolTree = () => {
		const tree = {
			name: "Tool Selection",
			children: [],
		};
		const sortedPackages = Object.keys(toolsByPackage).sort((a, b) =>
			a.localeCompare(b),
		);

		for (const packageName of sortedPackages) {
			const tools = toolsByPackage[packageName];
			const children = tools.map((toolName) => ({
				name: `🔧 ${toolName}`,
				value: toolName,
			}));

			tree.children.push({
				name: `📦 ${packageName} (${tools.length} tools)`,
				value: `${packageName}/*`,
				hasChildren: true,
				children,
			});
		}

		return tree;
	};

	// Interactive tree selection if no operation is provided in the command
	try {
		const selectedTools = await humanInterfaceService.askForTreeSelection({
			message: `Current enabled tools: ${activeTools.join(", ") || "none"}. Choose tools to enable:`,
			tree: buildToolTree(),
			multiple: true,
			allowCancel: true,
			initialSelection: activeTools,
		});

		if (selectedTools) {
			await registry.tools.setEnabledTools(...selectedTools);
			chatService.systemLine(`Set enabled tools: ${selectedTools.join(", ")}`);
		} else {
			chatService.systemLine("Tool selection cancelled. No changes made.");
		}
	} catch (error) {
		chatService.errorLine(`Error during tool selection:`, error);
	}
}

export function help() {
	return [
		"/tools [enable|disable|set] <tool1> <tool2> ...",
		"  - With no arguments: Shows interactive tree selection for tools grouped by package",
		"  - enable: Enable specific tools",
		"  - disable: Disable specific tools",
		"  - set: Set exactly which tools are enabled",
	];
}
