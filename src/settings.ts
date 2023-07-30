import {App, Setting, PluginSettingTab, Notice, SettingTab} from "obsidian";
import AIProxyLibraryPlugin from "./main";

export class AIProxyLibrarySettingTab extends PluginSettingTab {
    plugin: AIProxyLibraryPlugin;

    constructor(app: App, plugin: AIProxyLibraryPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    randomTips(): string {
        const tips = this.plugin.translation.tips;
        return tips[Math.floor(Math.random() * tips.length)];
    }


    display(): void {
        let { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h3", {text: this.plugin.translation.setting});
        new Setting(containerEl)
            // 展示插件的小贴士
            .setName(this.plugin.translation.tipTitle)
            .setDesc(this.randomTips())  // 给用户来点不一样的东西

        new Setting(containerEl)
            // api key
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
            // model name
            .setName(this.plugin.translation.settings.modelName)
            .setDesc(this.plugin.translation.settingDescriptions.modelName)
            .addText((text) =>
                text
                    .setPlaceholder(this.plugin.translation.settingPlaceHolders.modelName)
                    .setValue(this.plugin.settings.modelName)
                    .onChange(async (value) => {
                        this.plugin.settings.modelName = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            // ignore folders
            .setName(this.plugin.translation.settings.ignoreFolders)
            .setDesc(this.plugin.translation.settingDescriptions.ignoreFolders)
            .addText((text) =>
                text
                    .setPlaceholder(this.plugin.translation.settingPlaceHolders.ignoreFolders)
                    .setValue(this.plugin.settings.ignoreFolders)
                    .onChange(async (value) => {
                        this.plugin.settings.ignoreFolders = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            // library number
            .setName(this.plugin.translation.settings.libraryNumber)
            .setDesc(this.plugin.translation.settingDescriptions.libraryNumber)
            .addText((text) =>
                text
                    .setPlaceholder(this.plugin.translation.settingPlaceHolders.libraryNumber)
                    .setValue(String(this.plugin.settings.libraryNumber))
                    .onChange(async (value) => {
                        try {
                            Number(value);
                        }catch (e) {
                            new Notice(this.plugin.translation.needInputNumber);
                            return;
                        }
                        this.plugin.settings.libraryNumber = Number(value);
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            // aiproxy base url
            .setName(this.plugin.translation.settings.aiproxyBaseUrl)
            .setDesc(this.plugin.translation.settingDescriptions.aiproxyBaseUrl)
            .addText((text) =>
                text
                    .setPlaceholder(this.plugin.translation.settingPlaceHolders.aiproxyBaseUrl)
                    .setValue(this.plugin.settings.aiproxyBaseUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.aiproxyBaseUrl = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            // aiproxy ask url
            .setName(this.plugin.translation.settings.aiproxyAskUrl)
            .setDesc(this.plugin.translation.settingDescriptions.aiproxyAskUrl)
            .addText((text) =>
                text
                    .setPlaceholder(this.plugin.translation.settingPlaceHolders.aiproxyAskUrl)
                    .setValue(this.plugin.settings.aiproxyAskUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.aiproxyAskUrl = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            // use smarter text split
            .setName(this.plugin.translation.settings.useSmarterTextSplit)
            .setDesc(this.plugin.translation.settingDescriptions.useSmarterTextSplit)
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.useSmarterTextSplit)
                    .onChange(async (value) => {
                        this.plugin.settings.useSmarterTextSplit = false;  // TODO: 该功能还没开发好，先关掉，这不是bug，这是特性
                        await this.plugin.saveSettings();
                    })
            );


        new Setting(containerEl)
            // auto upload interval
            .setName(this.plugin.translation.settings.autoUploadInterval)
            .setDesc(this.plugin.translation.settingDescriptions.autoUploadInterval)
            .addDropdown((dropdown) =>
                dropdown
                    .addOptions({
                        "1": "1分钟",
                        "5": "5分钟",
                        "10": "10分钟",
                        "15": "15分钟",
                        "30": "30分钟",
                        "60": "60分钟",
                        "114514": "永不"
                    })
                    .setValue(String(this.plugin.settings.autoUploadInterval))
                    .onChange(async (value) => {
                        this.plugin.settings.autoUploadInterval = Number(value);
                        await this.plugin.saveSettings();
                        if (Number(value) !== 114514) {
                            this.plugin.registerInterval(window.setInterval(() => this.plugin.mappingFileCtrl.smartSync(), 1000*60*Number(value)));
                            console.log("auto upload register, interval: ", Number(value));
                        }else {
                            console.log("auto upload stop");
                        }
                    })
            );


    }

}