import * as fs from 'fs';
import {App, TFile} from "obsidian";
import AIPLibrary from "./aiproxy-api";
import {AIPLibrarySettings} from "./main"

interface SingleMdFileMapping {
    fileName: string;
    fileFullPath: string;
    fileStat: {
        ctime: number;
        mtime: number;
        size: number;
    };
    parentFolders: string[];
    aiproxyLibraryDocId?: string;
}


interface AIProxyDocInfo {
    docId: string;
    fileType: string;
    gmtCreate: string;
    gmtModified: string;
    libraryId: number;
    statusCode: string;
    statusMessage?: string;
    title: string;
    totalTokens: number;
    url: string;
    vectorSize: number;
}


export default class MappingFileController {
    jsonFilePath: string;
    settings: AIPLibrarySettings;
    app: App

    constructor(jsonFilePath: string, app: App, settings: AIPLibrarySettings) {
        // please called initMappingFile() after constructor!!!!!!!!!
        console.log(`Initializing MappingFileController with jsonFilePath=${jsonFilePath}`);
        this.jsonFilePath = jsonFilePath;
        this.app = app;
        this.settings = settings;
        // this.initMappingFile()
    }

    private readJson() {
        let data: string
        try {
            console.log(`Reading JSON file: ${this.jsonFilePath}`);
            data = fs.readFileSync(this.jsonFilePath, 'utf8')
            return JSON.parse(data);
        } catch (err) {
            // console.error("Failed to read the JSON file, the file might be corrupted. Starting initialization process after backing up.");
            // console.error(err.stack)
            // // 备份原文件
            // if (fs.existsSync(this.jsonFilePath + ".bak")){
            //     fs.rmSync(this.jsonFilePath + ".bak")
            // }
            // fs.renameSync(this.jsonFilePath, this.jsonFilePath + ".bak");
            // this.initMappingFile()
            // data = fs.readFileSync(this.jsonFilePath, 'utf8')
            // return JSON.parse(data);
            console.error("Failed to read the JSON file, the file might be corrupted. ");
            console.error(err.stack)
        }
    }

    private writeJson(data: any) {
        try {
            console.log(`Writing JSON file: ${this.jsonFilePath}`);
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


    private buildBaseMappingFile(): Array<SingleMdFileMapping> {
        // 根据本地最新文件列表构建一个基础的mapping文件（即不包含docId）
        const files = this.app.vault.getMarkdownFiles();
        const mappingArray: SingleMdFileMapping[] = [];
        for (const file of files) {
            const singleFileMapping = this.buildSingleFileMapping(file);
            mappingArray.push(singleFileMapping);
        }
        return mappingArray
    }

    async initMappingFile(): Promise<void> {
        // 在未找到json文件 或者 json文件为空的情况下，创建一个base mapping file，并将文件上传到aiproxy
        if (!fs.existsSync(this.jsonFilePath)) {
            const mappingArray = this.buildBaseMappingFile();
            this.writeJson(mappingArray);
            // 上传所有文件到aiproxy
            await this.uploadNoDocIdFilesToAIProxy()
        }
        if (fs.existsSync(this.jsonFilePath) && fs.readFileSync(this.jsonFilePath, 'utf8') === '') {
            const mappingArray = this.buildBaseMappingFile();
            this.writeJson(mappingArray);
            // 上传所有文件到aiproxy
            await this.uploadNoDocIdFilesToAIProxy()
        }
    }


    // 上传一个文件到aiproxy（只要提供文件path或TFile对象就可上传并自动生成映射数据）
    async uploadSingleFileToAIProxy(file: TFile | string): Promise<SingleMdFileMapping | null> {
        console.log(`Uploading single file to AI Proxy: ${file}`);
        let Tfile: TFile;
        if (typeof file === "string") {
             const cfile = this.app.vault.getAbstractFileByPath(file);
             if (cfile == null) {
                    console.error("This file does not exist, please check the path")
                    return null;
             }
             if (cfile instanceof TFile) {
                 Tfile = cfile;
             }else{
                    console.error("This file is not a markdown file, please check the path")
                    return null;
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
            if (singleFileMapping != null) {
                singleFileMapping.aiproxyLibraryDocId = docId;
                return singleFileMapping;
            }
            return this.buildSingleFileMapping(Tfile, docId);
        }
        return null
    };


    // 将所有本地有映射数据，但无docId的文件上传到aiproxy(大小为0的直接排除，因为上传也会报错)
    async uploadNoDocIdFilesToAIProxy(): Promise<void> {
        console.log("Start uploading files without docId to AI Proxy");
        let successCount = 0;
        const mappingArray: SingleMdFileMapping[] = this.readJson();
        const updatedMappings: SingleMdFileMapping[] = []
        for (const singleFileMapping of mappingArray) {
            if (singleFileMapping.aiproxyLibraryDocId == null && singleFileMapping.fileStat.size !== 0) {
                const r = await this.uploadSingleFileToAIProxy(singleFileMapping.fileFullPath);
                if (r != null) {
                    successCount++;
                    singleFileMapping.aiproxyLibraryDocId = r.aiproxyLibraryDocId;
                    updatedMappings.push(singleFileMapping);
                } // 如果上传失败，就不更新mapping，相当于直接删除该节点，等待下次同步时再次上传
            }else{
                updatedMappings.push(singleFileMapping);
            }
        }
        this.writeJson(updatedMappings);
        console.log(`Upload ${successCount} files to AI Proxy successfully`);
        console.log("Finish uploading files without docId to AI Proxy");

    }


    async rebuidMappingFile(): Promise<void> {
        // 高危操作 球球了能跑就别动
        console.log("Start rebuilding the mapping file");
        // 拉取远端所有文档的docId，和本地得到的最新所有文件路径进行比对，将匹配的数据重新写入mapping文件，如果本地有，但远端没有，就正常写入，但docId为null，如果远端有，本地没有，就忽视
        const remoteDocs = await this.getAllDocsFromAIProxy()
        const newMappingFile: SingleMdFileMapping[] = this.buildBaseMappingFile();
        const mappingArray: SingleMdFileMapping[] = []
        for (const localFileMapping of newMappingFile) {
            const remoteDoc = remoteDocs.find((item: AIProxyDocInfo) => item.title === localFileMapping.fileName);
            if (remoteDoc != null) {
                console.log(`${localFileMapping.fileName} -> ${remoteDoc.docId}    mapping success`);
                localFileMapping.aiproxyLibraryDocId = remoteDoc.docId;
                mappingArray.push(localFileMapping);
            }else {
                console.log(`${localFileMapping.fileName} -> null    mapping failed`);
                mappingArray.push(localFileMapping);
            }
        }
        console.log("rebuild mapping file done");
        this.writeJson(mappingArray);
    }


    async incrementalFileSync(): Promise<void> {
        console.log("Start incremental files synchronization");
        // 将本地文件增量同步到aiproxy（注意，仅仅是文件，不会关注具体内容是否变化）
        // 这个函数将做两件事：1. 将本地新增文件上传到aiproxy并更新本地mapping文件（这部分文件是本地mapping所没有的） 2. 将本地没有docId的文件上传到aiproxy并更新本地mapping文件（这部分文件是本地mapping有，但是docId为空的）
        const mappingArray = this.readJson();
        const baseMappingFile: SingleMdFileMapping[] = this.buildBaseMappingFile();
        const newMappingArray: SingleMdFileMapping[] = [];
        console.log("start uploading new files to AI Proxy");
        for (const singleFileMapping of baseMappingFile) {
            // 查找是否与本地mapping文件有匹配的文件名
            const localFileMapping = mappingArray.find((item: SingleMdFileMapping) => item.fileFullPath === singleFileMapping.fileFullPath);
            if (localFileMapping != null) {
                // 本地mapping文件有匹配的文件名，直接使用本地mapping文件的数据
                newMappingArray.push(localFileMapping);
            }else {
                // 先push，一会统一处理没docId的mapping
                newMappingArray.push(singleFileMapping);
            }
        }
        this.writeJson(newMappingArray);
        console.log("finish uploading new files to AI Proxy");
        console.log("start uploading files without docId to AI Proxy");
        await this.uploadNoDocIdFilesToAIProxy();
        console.log("finish uploading files without docId to AI Proxy");
    }


    private async getAllDocsFromAIProxy(): Promise<AIProxyDocInfo[]> {
        const AIP = new AIPLibrary(this.settings.apiKey);
        const remoteDocs = await AIP.listDocs(this.settings.libraryNumber, 1, 100);
        // noinspection JSUnresolvedReference
        const totalPages = remoteDocs.data.totalPages;
        const remoteDocsArray: AIProxyDocInfo[] = [];
        for (let i = 1; i <= totalPages; i++) {
            const r = await AIP.listDocs(this.settings.libraryNumber, i, 100);
            // noinspection JSUnresolvedReference
            remoteDocsArray.push(...r.data.records);
        }
        return remoteDocsArray;
    }


    async removeCallback(file: TFile): Promise<void> {
        // 删除本地文件时，删除aiproxy中的对应文档
        // 某些极端情况下可能会存在docId没有正确映射的情况，这时候需要再加上文件名双重判断
        const mappingArray = this.readJson();
        const singleFileMapping = mappingArray.find((item: SingleMdFileMapping) => item.fileFullPath === file.path);
        if (singleFileMapping != null) {
            if (singleFileMapping.aiproxyLibraryDocId != null) {
                const AIP = new AIPLibrary(this.settings.apiKey);
                await AIP.deleteDoc([singleFileMapping.aiproxyLibraryDocId], this.settings.libraryNumber);
                console.log(`delete ${file.path} from AI Proxy successfully`);
            }else {
                console.log(`delete ${file.path} from AI Proxy failed, because docId is null`);
                console.log("now try to delete by file name");
                const AIP = new AIPLibrary(this.settings.apiKey);
                const remoteDocs = await this.getAllDocsFromAIProxy();
                const remoteDoc = remoteDocs.find((item: AIProxyDocInfo) => item.title === singleFileMapping.fileFullPath);
                if (remoteDoc != null) {
                    await AIP.deleteDoc([remoteDoc.docId], this.settings.libraryNumber);
                    console.log(`delete ${file.path} from AI Proxy successfully`);
                }
            }
        }
    }


    async smartSync(): Promise<void> {
        // 整个系统的入口函数，这个函数被调用时会做这几件事
        // 1. 调用增量同步函数，将本地实际数据和mapping文件以及aiproxy三端数据对齐
        // 2. 再获取本地所有文件的大小，与远端进行比对，如有不一致，所有以本地为准，这些文件会被重新上传到aiproxy
        // 3. 重新生成mapping文件

        // notice: mapping文件所记录的文件大小和修改时间等数据，是在文件上传到aiproxy时记录的，可以看作aiproxy的记录，所以只需获取最新的与本地比对（后期可以考虑增加on_modify事件，来减轻每次同步的复杂度）
        await this.incrementalFileSync();
        const mappingArray: SingleMdFileMapping[] = this.readJson();
        const baseMappingFile: SingleMdFileMapping[] = this.buildBaseMappingFile();
        const newMappingArray: SingleMdFileMapping[] = [];
        const AIP = new AIPLibrary(this.settings.apiKey);
        for (const singleFileMapping of mappingArray) {
            if (singleFileMapping.aiproxyLibraryDocId != null) {
                const correntFile = baseMappingFile.find((item: SingleMdFileMapping) => item.fileFullPath === singleFileMapping.fileFullPath);
                if (correntFile != null) {
                    if (correntFile.fileStat.size > singleFileMapping.fileStat.size) {
                        console.log(`${correntFile.fileName} -> ${singleFileMapping.aiproxyLibraryDocId}    file may changed, upload again`);
                        await AIP.deleteDoc([singleFileMapping.aiproxyLibraryDocId], this.settings.libraryNumber);
                        const newDocId = await this.uploadSingleFileToAIProxy(correntFile.fileFullPath);
                        if (newDocId != null) {
                            correntFile.aiproxyLibraryDocId = newDocId.aiproxyLibraryDocId;
                            newMappingArray.push(correntFile);
                        }
                    }
                }
            }

        }
    }


}