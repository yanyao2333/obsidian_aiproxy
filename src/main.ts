import {App, FileSystemAdapter, ItemView, Notice, Plugin, PluginManifest, TFile, TFolder} from 'obsidian';
import AIPLibrary from './aiproxy-api';
import {AIProxyLibrarySettingTab} from "./settings";
import MappingFileController from "./mapping-control";
import * as path from "path";
import {DEFAULT_TRANSLATION, LocalizedStrings, VIEW_TYPE} from "./constants";
import {ChatViewType} from "./view";

export interface AIPLibrarySettings {
	// define user settings
	apiKey: string;
	modelName: string;
	ignoreFolders: string;  // 逗号分隔的文件夹名
	libraryNumber: number;
	aiproxyBaseUrl: string;
	aiproxyAskUrl: string;
	useSmarterTextSplit: boolean;
	autoUploadInterval: number;  // 自动上传的时间间隔，单位为分钟
}

const DEFAULT_SETTINGS: AIPLibrarySettings = {
	modelName: "gpt-3.5-turbo",
	libraryNumber: 0,
	apiKey: "",
	aiproxyBaseUrl: "https://aiproxy.io/api",
	aiproxyAskUrl: "https://api.aiproxy.io/api/library/ask",
	ignoreFolders: "",
	useSmarterTextSplit: false,
	autoUploadInterval: 114514
}


export let g_app: App;
export let g_settings: AIPLibrarySettings;



export default class AIProxyLibraryPlugin extends Plugin {
	settings: AIPLibrarySettings;
	translation: LocalizedStrings;
	mappingFileCtrl: MappingFileController;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		g_app = this.app;
		g_settings = this.settings;
		this.settings = DEFAULT_SETTINGS;
		this.translation = DEFAULT_TRANSLATION;
	}

	async onload() {
		console.log('loading plugin: aiproxy-library');

		await this.loadSettings();

		// loading command...
		this.addCommand({
			id: 'manual-add-doc',
			name: this.translation.manualUploadDoc,
			callback: () => {
				this.mappingFileCtrl.manualAddDoc();
			},
			// hotkeys: [
			// 	{
			// 		modifiers: ["Mod", "Shift"],
			// 		key: "a",
			// 	},
			// ],
		});

		this.addCommand({
			id: 'rebuild-mapping-file',
			name: this.translation.RebuildMappingFile,
			callback: () => {
				this.mappingFileCtrl.rebuidMappingFile();
			}
		});

		this.addCommand({
			id: 'smart-sync',
			name: this.translation.smartSync,
			callback: () => {
				this.mappingFileCtrl.smartSync();
			}
		});


		// loading setting tab...
		this.addSettingTab(new AIProxyLibrarySettingTab(this.app, this));


		// loading event...
		this.registerEvent(this.app.vault.on("delete", (file) => {
			console.log("delete file: ", file);
			if (file instanceof TFile) {
				this.mappingFileCtrl.removeFileCallback(file);
			} else if (file instanceof TFolder) {
				this.mappingFileCtrl.removeFolderCallback(file);
			}
		}));

		// loading interval...
		if (this.settings.autoUploadInterval !== 114514) {
			this.registerInterval(window.setInterval(() => this.mappingFileCtrl.smartSync(), 1000 * 60 * this.settings.autoUploadInterval));
			console.log("auto upload register, interval: ", this.settings.autoUploadInterval);
		}

		// loading mapping file controller...
		this.mappingFileCtrl = new MappingFileController(this.getMappingJsonDir(), this.app, this.settings);

		// loading view...
		this.registerView(
			VIEW_TYPE,
			(leaf) => new ChatViewType(leaf)
		);
		this.addRibbonIcon("dice", "Activate view", () => {
			this.activateView();
		});
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign(this.settings, await this.loadData());
		g_settings = this.settings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
		g_settings = this.settings;
	}


	getMappingJsonDir() {
		let adapter = app.vault.adapter;
		let basePath = "./";
		// 根据论坛说法，这个adapter在手机端不一定是FileSystemAdapter，所以要判断一下
		if (adapter instanceof FileSystemAdapter) {
			basePath = adapter.getBasePath();
		}
		const configDir = this.app.vault.configDir;
		return path.join(basePath, configDir, "plugins", "obsidian-aiproxy", "mapping.json");
	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: VIEW_TYPE,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
		);
	}
}