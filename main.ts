import {
	App,
	Notice,
	Plugin,
	PluginManifest
} from 'obsidian';
import AIPLibrary from './aiproxy-api';
import {AIProxyLibrarySettingTab} from "./settings";

interface AIPLibrarySettings {
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
	autoUploadInterval: 30
}

interface LocalizedStrings {
	// 将散落在代码中的字符串统一管理，方便后期修改
	settings: {
		apiKey: string;
		modelName: string;
		ignoreFolders: string;
		libraryNumber: string;
		aiproxyBaseUrl: string;
		aiproxyAskUrl: string;
		useSmarterTextSplit: string;
		autoUploadInterval: string;
	};
	settingDescriptions: {
		apiKey: string;
		modelName: string;
		ignoreFolders: string;
		libraryNumber: string;
		aiproxyBaseUrl: string;
		aiproxyAskUrl: string;
		useSmarterTextSplit: string;
		autoUploadInterval: string;
	};
	settingPlaceHolders: {
		apiKey: string;
		modelName: string;
		ignoreFolders: string;
		libraryNumber: string;
		aiproxyBaseUrl: string;
		aiproxyAskUrl: string;
		useSmarterTextSplit: string;
		autoUploadInterval: string;
	};
	setting: string;
	RebuildMappingFile: string;  // 预期最后会以json文件的方式保存本地文件名和aiproxy的docId的映射
	askTextBoxPlaceholder: string;
	manualUploadDoc: string;
	tips: string[];
	successManualUploadDoc: string;
	failedManualUploadDoc: string;
	noActiveFileOrNotMarkdown: string;
	emptyApiKey: string;
	tipTitle: string;
	needInputNumber: string;
	useMyInviteCode: string;
}

const DEFAULT_TRANSLATION: LocalizedStrings = {
	settings: {
		apiKey: "API Key",
		modelName: "模型名称",
		ignoreFolders: "忽略的文件夹",
		libraryNumber: "知识库ID",
		aiproxyBaseUrl: "base url",
		aiproxyAskUrl: "ask url",
		useSmarterTextSplit: "使用更智能的文本分割(开发中)",
		autoUploadInterval: "自动上传的时间间隔（分钟）"
	},
	settingDescriptions: {
		apiKey: `在aiproxy.io注册并获取API Key，请确保您在生成key时选择了下方使用的模型`,
		modelName: "模型类型，跟openai官网一致，推荐选择gpt-3.5-turbo/gpt-4",
		ignoreFolders: "逗号分隔的文件夹名，这些文件夹下的文件不会被上传到aiproxy知识库",
		libraryNumber: "知识库ID，可以在aiproxy.io创建并查看",
		aiproxyBaseUrl: "aiproxy的base url，一般不需要修改",
		aiproxyAskUrl: "aiproxy的ask url，一般不需要修改",
		useSmarterTextSplit: "使用更智能的文本分割(开发中)",
		autoUploadInterval: "自动上传的时间间隔（分钟）"
	},
	settingPlaceHolders: {
		apiKey: "填入您在aiproxy.io复制的API Key",
		modelName: "填入您想使用的模型名称，跟openai官网支持的模型一致",
		ignoreFolders: "填入您不想上传的文件夹名，逗号分隔",
		libraryNumber: "填入您在aiproxy.io创建的知识库ID",
		aiproxyBaseUrl: "aiproxy的base url，一般不需要修改",
		aiproxyAskUrl: "aiproxy的ask url，一般不需要修改",
		useSmarterTextSplit: "使用更智能的文本分割(开发中)",
		autoUploadInterval: "自动上传的时间间隔（分钟）"
	},
	setting: "Obsidian-AIProxy 设置",
	RebuildMappingFile: "重建本地markdown文件路径和aiproxy知识库的docId的映射（能跑就别动）",
	askTextBoxPlaceholder: "在这里输入您想要问的问题",
	manualUploadDoc: "手动（重新）上传文件（一般而言不用）",
	tips: [
		"别忘了填入api key哦",
		"注册和首次充值时使用我的激活码（激活码：daidai）可以有3%的额外奖励！",
		"该插件处于Beta阶段，如果有任何问题或者建议，欢迎用issue和pr砸我！（最好是pr）"
	],
	successManualUploadDoc: "成功上传文件",
	failedManualUploadDoc: "上传文件失败",
	noActiveFileOrNotMarkdown: "没有活动中的文件或者活动中的文件不是markdown文件",
	emptyApiKey: "请先在设置中填入API Key\n否则我要罢工了!",
	tipTitle: "Obsidian-AIProxy 使用小贴士",
	needInputNumber: "请确认自己输入的是纯数字！",
	useMyInviteCode: "<a href='https://aiproxy.io/?i=daidai' target='_blank'>使用我的激活码（daidai）</a>注册并充值可以获得3%的额外奖励！"
}



export default class AIProxyLibraryPlugin extends Plugin {
	settings: AIPLibrarySettings;
	translation: LocalizedStrings;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		this.settings = DEFAULT_SETTINGS;
		this.translation = DEFAULT_TRANSLATION;
	}

	async onload() {
		console.log('loading plugin: aiproxy-library');

		await this.loadSettings();

		this.addCommand({
			id: 'manual-add-doc',
			name: this.translation.manualUploadDoc,
			callback: () => {
				this.manualAddDoc();
			},
			// hotkeys: [
			// 	{
			// 		modifiers: ["Mod", "Shift"],
			// 		key: "a",
			// 	},
			// ],
		});


		this.addSettingTab(new AIProxyLibrarySettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(this.settings, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async manualAddDoc() {
		if (!this.settings.apiKey) {
			new Notice(this.translation.emptyApiKey);
			return;
		}
		const aiplib = new AIPLibrary(this.settings.apiKey, this.settings.aiproxyBaseUrl);
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			new Notice(this.translation.noActiveFileOrNotMarkdown);
			return;
		}
		const content = await this.app.vault.read(activeFile);
		const title = activeFile.basename;
		const libraryId = this.settings.libraryNumber;
		const resp = await aiplib.add_doc_by_text(libraryId, content, title);
		if (resp.success) {
			new Notice(this.translation.successManualUploadDoc + ` "${title}"` + "\n" + `docId: ${resp.data}`);
		} else {
			new Notice(this.translation.failedManualUploadDoc + "\n" + resp.errMsg);
		}
	}
}