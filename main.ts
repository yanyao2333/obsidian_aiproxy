import {App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile} from 'obsidian';
import AIPLibrary from './aiproxy-api';

interface AIPLibrarySettings {
	// define user settings
	apiKey: string;
	modelType: string;
	ignoreFolders: string[];  //besides this, we also need to check the FrontMatter if it has a tag "ignore"(TODO)
	libraryNumber: number;
	aiproxyBaseUrl: string;
	aiproxyAskUrl: string;
}

const DEFAULT_SETTINGS: AIPLibrarySettings = {
	modelType: "gpt-3.5-turbo",
	libraryNumber: 0,
	apiKey: "",
	aiproxyBaseUrl: "https://api.aiproxy.io/api",
	aiproxyAskUrl: "https://api.aiproxy.io/api/library/ask",
	ignoreFolders: []
}

async function deleteDocOnAiproxy(file: TAbstractFile){
	const library = new AIPLibrary(this.settings.apiKey);
	const docId = this.file.basename;
	const resp = await library.deleteDocument(docId);
	if (resp.status !== 200) {
		new Notice(resp.data.message);
	}
}

class AIProxyLibraryPlugin extends Plugin {
	async onload() {
		this.registerEvent(this.app.vault.on("delete", deleteDocOnAiproxy));
	}
}

class CuboxSettingTab extends PluginSettingTab {
	plugin: CuboxPlugin;

	constructor(app: App, plugin: CuboxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(this.plugin.translation.settings.apiKey)
			.setDesc(this.plugin.translation.settingDescriptions.apiKey)
			.addText((text) =>
				text
					.setPlaceholder(this.plugin.translation.settingPlaceHolders.apiKey)
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(this.plugin.translation.settings.defaultTags)
			.setDesc(this.plugin.translation.settingDescriptions.defaultTags)
			.addText((text) =>
				text
					.setPlaceholder(this.plugin.translation.settingPlaceHolders.defaultTags)
					.setValue(this.plugin.settings.defaultTags)
					.onChange(async (value) => {
						this.plugin.settings.defaultTags = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(this.plugin.translation.settings.defaultFolder)
			.setDesc(this.plugin.translation.settingDescriptions.defaultFolder)
			.addText((text) =>
				text
					.setPlaceholder(this.plugin.translation.settingPlaceHolders.defaultFolder)
					.setValue(this.plugin.settings.defaultFolder)
					.onChange(async (value) => {
						this.plugin.settings.defaultFolder = value;
						await this.plugin.saveSettings();
					})
			);
	}

}
