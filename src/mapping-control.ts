import * as fs from 'fs';
import {TFile, App, TAbstractFile, TFolder} from "obsidian";
import AIPLibrary from "./aiproxy-api";
import {AIPLibrarySettings} from "./main"

interface SingleMdFileMapping {
    "fileName": string;
    "fileFullPath": string;
    "fileStat": {
        "ctime": number;
        "mtime": number;
        size: number;
    },
    parentFolders: string[];
    aiproxyLibraryDocId?: string;
}

export default class MappingFileController {
    jsonFilePath: string;
    settings: AIPLibrarySettings;
    app: App

    constructor(jsonFilePath: string, app: App, settings: AIPLibrarySettings) {
        this.jsonFilePath = jsonFilePath;
        this.app = app;
        this.settings = settings;
        this.initMappingFile()
    }

    private readJson() {
        let data: string
        try {
            data = fs.readFileSync(this.jsonFilePath, 'utf8')
            return JSON.parse(data);
        } catch (err) {
            console.error("读取json文件失败，可能文件已损坏，备份后进入初始化流程")
            console.error(err.stack)
            // 备份原文件
            fs.renameSync(this.jsonFilePath, this.jsonFilePath + ".bak");
            this.initMappingFile()
            return null
        }
    }

    private writeJson(data: any) {
        try {
            fs.writeFileSync(this.jsonFilePath, JSON.stringify(data, null, 4), 'utf8')
        } catch (err) {
            console.error(err.stack)
        }
    }


    // 根据TFile构建单文件的映射信息
    private buildSingleFileMapping(file: TFile, docId?: string): SingleMdFileMapping {
        const fileStat = file.stat
        let parentFolders: string[] = [];
        let currentLevel = file;

        while (true) {
            const parent = currentLevel.parent;
            if (parent == null) {
                break;
            }
            parentFolders.push(parent.name);
            // @ts-ignore
            currentLevel = parent;
        }

        const fileFullPath = file.path;
        const fileName = file.name;
        if (docId != null) {
            return {
                fileName: fileName,
                fileFullPath: fileFullPath,
                fileStat: {
                    ctime: fileStat.ctime,
                    mtime: fileStat.mtime,
                    size: fileStat.size
                },
                parentFolders: parentFolders,
                aiproxyLibraryDocId: docId
            }
        }
        return {
            fileName: fileName,
            fileFullPath: fileFullPath,
            fileStat: {
                ctime: fileStat.ctime,
                mtime: fileStat.mtime,
                size: fileStat.size
            },
            parentFolders: parentFolders
        }
    }


    // 构建初始化的mapping文件
    private buildInitMappingFile(): Array<SingleMdFileMapping> {
        const files = this.app.vault.getMarkdownFiles();
        const mappingArray: SingleMdFileMapping[] = [];
        for (const file of files) {
            const singleFileMapping = this.buildSingleFileMapping(file);
            mappingArray.push(singleFileMapping);
        }
        return mappingArray
    }

    initMappingFile(): void {
        // 在未找到json文件 或者 json文件为空的情况下，创建一个base mapping file
        if (!fs.existsSync(this.jsonFilePath)) {
            const mappingArray = this.buildInitMappingFile();
            this.writeJson(mappingArray);
        }
        if (fs.existsSync(this.jsonFilePath) && fs.readFileSync(this.jsonFilePath, 'utf8') === '') {
            const mappingArray = this.buildInitMappingFile();
            this.writeJson(mappingArray);
        }
    }


    // 上传一个文件到aiproxy（只要提供文件path或TFile对象就可上传并自动生成映射数据）
    async uploadSingleFileToAIProxy(file: TFile | string) {
        let Tfile: TFile;
        if (typeof file === "string") {
             const cfile = this.app.vault.getAbstractFileByPath(file);
             if (cfile == null) {
                    console.error("未找到该文件，请检查路径是否正确或是否已被删除")
                    return false;
             }
             if (cfile instanceof TFile) {
                 Tfile = cfile;
             }else{
                    console.error("该路径指向了一个目录，请检查路径是否正确")
                    return false;
             }
        }
        else {
            Tfile = file;  // 蜜汁作用域，看不懂，只好这样写了
        }
        const mappingArray = this.readJson();
        const aiplib = new AIPLibrary(this.settings.apiKey);
        const content = await this.app.vault.cachedRead(Tfile)
        const r = await aiplib.add_doc_by_text(this.settings.libraryNumber, content, Tfile.path)
        if (r.success) {
            const docId = r.data;
            const singleFileMapping = mappingArray.find((item: SingleMdFileMapping) => item.fileFullPath === Tfile.path);
            console.log(singleFileMapping)
            if (singleFileMapping != null) {
                mappingArray.remove(singleFileMapping)
                singleFileMapping.aiproxyLibraryDocId = docId;
                mappingArray.push(singleFileMapping);
                console.log("上传成功，我要更新映射文件了")
                console.log(mappingArray)
                this.writeJson(mappingArray);
                return true
            }
            const newSingleFileMapping = this.buildSingleFileMapping(Tfile, docId);
            mappingArray.push(newSingleFileMapping);
            console.log("上传成功，我要更新映射文件了")
            console.log(mappingArray)
            this.writeJson(mappingArray);
            return true
        }
        console.error("上传文件失败，请检查上方日志")
        return false
    };

    // 将所有本地有映射数据，但无docId的文件上传到aiproxy(大小为0的直接排除，因为上传也会报错)
    async uploadNoDocIdFilesToAIProxy(): Promise<void> {
        let mappingArray = this.readJson();
        let count = 0;
        for (const singleFileMapping of mappingArray) {
            if (singleFileMapping.aiproxyLibraryDocId == null && singleFileMapping.fileStat.size != 0) {
                const resp = await this.uploadSingleFileToAIProxy(singleFileMapping.fileFullPath)
                if (resp) {
                    count += 1;
                }else{
                    console.error("上传文件失败，大概是文件被删除")
                }
                mappingArray = this.readJson();
            }
        }
        console.log(`总共上传了${count}个文件，感觉自己好棒！`)
        return;
    }


}