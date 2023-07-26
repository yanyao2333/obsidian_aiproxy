import axios, {AxiosResponse} from "axios";


interface AIPLibraryResponse {
    data: any,
    success: boolean,
    errMsg?: string,
}

class AIPLibrary {
    private readonly BASE_URL: string;
    private readonly apiKey: string;

    constructor(api_key: string, BASE_URL = "https://aiproxy.io/api") {
        this.apiKey = api_key;
        if (BASE_URL.endsWith("/")) {
            BASE_URL = BASE_URL.slice(0, -1);
        }
        this.BASE_URL = BASE_URL;
    }

    respCheck(resp: any): boolean {
        return !(resp.status != 200 || resp.data.success != true || resp.data.errorCode != 0);
    }

    async createLibrary(library_name: string, description: string): Promise<AIPLibraryResponse> {
        // return: {data: {libraryId: number}, success: boolean, errMsg?: string}
        const _url = this.BASE_URL + "/library/create";
        const _headers = {
            "Content-Type": "application/json",
            "Api-Key": this.apiKey
        }
        const _data = {
            "libraryName": library_name,
            "description": description
        }

        try {
            const _resp = await axios.post(_url, _data, {headers: _headers});
            if (!this.respCheck(_resp)) {
                return { data: _resp.data, success: false, errMsg: _resp.data.message };
            }
            return { data: _resp.data.data, success: true };
        }catch (e) {
            return { data: e, success: false, errMsg: e.message };
        }
    }

    async add_doc_by_url(library_id: number, urls: string[], refresh: boolean = true): Promise<AIPLibraryResponse> {
        // return: {data: {docIds: string[]}, success: boolean, errMsg?: string}
        const _url = `${this.BASE_URL}/library/document/createByUrl`;
        const _headers = {
            "Api-Key": this.apiKey
        };
        const _data = {
            "libraryId": library_id,
            "refresh": refresh,
            "urls": urls
        };
        try {
            const _resp = await axios.post(_url, _data, {headers: _headers});
            if (!this.respCheck(_resp)) {
                return { data: _resp.data, success: false, errMsg: _resp.data.message };
            }
            return { data: _resp.data.data, success: true };
        }catch (e) {
            return {data: e, success: false, errMsg: e.message};
        }
    }

    async add_doc_by_text(library_id: number, text: string, title: string, doc_url: string = ""): Promise<AIPLibraryResponse> {
        // return: {data: {docId: string}, success: boolean, errMsg?: string}
        const _url = `${this.BASE_URL}/library/document/createByText`;
        const _headers = {
            "Api-Key": this.apiKey
        };
        const _data = {
            "libraryId": library_id,
            "text": text,
            "title": title,
            "url": doc_url?.toString()
        };
        try {
            const _resp = await axios.post(_url, _data, {headers: _headers});
            if (!this.respCheck(_resp)) {
                return { data: _resp.data, success: false, errMsg: _resp.data.message };
            }
            return { data: _resp.data.data, success: true };
        }catch (e) {
            return {data: e, success: false, errMsg: e.message};
        }
    }

    async deleteDoc(docIds: string[], libraryId: number): Promise<AIPLibraryResponse> {
        // return: {data: boolean | Error, success: boolean, errMsg?: string}
        const url = `${this.BASE_URL}/library/document/delete`;
        const data = {
            libraryId,
            docIds
        };
        const _headers = {
            "Api-Key": this.apiKey
        };
        try {
            const _resp = await axios.post(url, data, {headers: _headers});
            if (!this.respCheck(_resp)) {
                return { data: _resp.data, success: false, errMsg: _resp.data.message };
            }
            return { data: true, success: true };
        }catch (e) {
            return {data: e, success: false, errMsg: e.message};
        }
    }

    async ask(libraryId: number, query: string, model: string = "gpt-3.5-turbo", stream: boolean = false, url: string = "https://api.aiproxy.io/api/library/ask", timeout: number = 90000): Promise<AIPLibraryResponse> {
        // return: {data: dict, success: boolean, errMsg?: string}
        if (stream) {
            throw new Error("Streaming is currently not supported");
        }
        const headers = {
            Authorization: `Bearer ${this.apiKey}`
        };

        const data = {
            libraryId,
            model,
            query,
            stream
        };
        try {
            const resp = await axios.post(url, data, {headers, timeout});
            if (resp.status != 200 || resp.data.success != true) {
                return { data: resp.data, success: false, errMsg: resp.data.message };
            }
            return { data: resp.data, success: true };
        }catch (e) {
            return {data: e, success: false, errMsg: e.message};
        }
    }

    async editLibrary(libraryObj: Library): Promise<AIPLibraryResponse> {
        // return: {data: boolean | Error, success: boolean, errMsg?: string}
        const url = `${this.BASE_URL}/library/update`;
        const data = {
            libraryId: libraryObj.libraryId,
            libraryName: libraryObj.libraryName,
            description: libraryObj.description,
            language: libraryObj.language,
            noAnswer: libraryObj.noAnswer,
            enableDocumentAnnotate: libraryObj.enableDocumentAnnotate,
            enableLogicalReasoning: libraryObj.enableLogicalReasoning,
            similarityTopK: libraryObj.similarityTopK
        };
        const _headers = {
            "Api-Key": this.apiKey
        };
        try {
            const resp = await axios.post(url, data, {headers: _headers});
            if (!this.respCheck(resp)) {
                return { data: resp.data, success: false, errMsg: resp.data.message };
            }
            return { data: true, success: true };
        }catch (e) {
            return {data: e, success: false, errMsg: e.message};
        }
    }

    async getLibrary(libraryId: number): Promise<AIPLibraryResponse> {
        // return: {data: Library | Error, success: boolean, errMsg?: string}
        const url = `${this.BASE_URL}/library/get`;
        const params = {
            libraryId
        };
        const _headers = {
            "Api-Key": this.apiKey
        };
        let resp: AxiosResponse;
        try {
            resp = await axios.get(url, {params, headers: _headers});
            if (resp.status != 200 || resp.data.success != true || resp.data.errorCode != 0 || resp.data.data == null) {
                // 这里有坑，当get一个不存在或不属于自己的library时，msg和success都是正常的，但是data是null，需要单独处理
                return { data: resp.data, success: false, errMsg: "libraryId not found or it is not owned to you" };
            }
        }catch (e) {
            return {data: e, success: false, errMsg: e.message};
        }

        const data = resp.data.data;
        const libraryObj: Library = {
            libraryId: data.id,
            libraryName: data.libraryName,
            description: data.description,
            language: data.language,
            noAnswer: data.noAnswer,
            enableDocumentAnnotate: data.enableDocumentAnnotate,
            enableLogicalReasoning: data.enableLogicalReasoning,
            similarityTopK: data.similarityTopK
        };

        return { data: libraryObj, success: true };
    }


    async listDocs(libraryId: number, page: number, pageSize: number, order: Order = Order.DESC, orderBy: OrderBy = OrderBy.GMT_CREATE): Promise<AIPLibraryResponse> {
        // return: dict, success: boolean, errMsg?: string}
        const url = `${this.BASE_URL}/library/listDocument`;
        const params = {
            libraryId,
            page,
            pageSize,
            order,
            orderBy
        };
        const _headers = {
            "Api-Key": this.apiKey
        };
        try {
            const resp = await axios.get(url, {params, headers: _headers});
            if (!this.respCheck(resp)) {
                return { data: resp.data, success: false, errMsg: resp.data.message };
            }
            return { data: resp.data.data, success: true };
        }catch (e) {
            return {data: e, success: false, errMsg: e.message};
        }
    }
}

export enum Order {
    ASC = "asc",
    DESC = "desc"
}

export enum OrderBy {
    GMT_CREATE = "gmtCreate",
    GMT_MODIFIED = "gmtModified",
    LIBRARY_NAME = "libraryName"
}

interface Library {
    libraryId: number,
    libraryName: string,
    description: string,
    language: string,
    noAnswer: boolean,
    enableDocumentAnnotate: boolean,
    enableLogicalReasoning: boolean,
    similarityTopK: number
}