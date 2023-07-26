import axios, {AxiosResponse} from 'axios';

class AIPLibrary {
    client = axios.create();
    BASE_URL: string;
    apiKey: string;

    constructor(api_key: string, BASE_URL = "https://aiproxy.io/api") {
        this.apiKey = api_key;
        if (BASE_URL.endsWith("/")) {
            BASE_URL = BASE_URL.slice(0, -1);
        }
        this.BASE_URL = BASE_URL;
    }

    async createLibrary(library_name: string, description: string): Promise<number> {
        const _url = this.BASE_URL + "/library/create";
        const _headers = {
            "Content-Type": "application/json",
            "Api-Key": this.apiKey
        }
        const _data = {
            "libraryName": library_name,
            "description": description
        }

        const _resp = await this.client.post(_url, {data: _data, headers: _headers});
        if (!this.respCheck(_resp)) {
            throw new Error(_resp.data.message);
        }
        return _resp.data.data;
    }

    async add_doc_by_url(library_id: number, urls: string[], refresh: boolean = true): Promise<string[]> {
        const _url = `${this.BASE_URL}/library/document/createByUrl`;
        const _headers = {
            "Api-Key": this.apiKey
        };
        const _data = {
            "libraryId": library_id,
            "refresh": refresh,
            "urls": urls
        };
        let _resp: AxiosResponse;
        try {
            _resp = await axios.post(_url, _data, { headers: _headers });
        } catch (e) {
            throw new Error(e.message);
        }
        return _resp.data.data;
    }

    async add_doc_by_text(library_id: number, text: string, title: string, doc_url: string = ""): Promise<string> {
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
        let _resp: AxiosResponse;
        try {
            _resp = await axios.post(_url, _data, { headers: _headers });
        } catch (e) {
            throw new Error(e.message);
        }
        return _resp.data.data;
    }

    respCheck(resp: any): boolean {
        return !(resp.status != 200 || resp.data.success != true || resp.data.errorCode != 0);
    }

    async deleteDoc(docIds: string[], libraryId: number): Promise<boolean> {
        const url = `${this.BASE_URL}/library/document/delete`;
        const data = {
            libraryId,
            docIds
        };
        const _headers = {
            "Api-Key": this.apiKey
        };
        const response = await axios.post(url, data, { headers: _headers });

        if (!this.respCheck(response)) {
            throw new Error(response.data.message);
        }

        return true;
    }

    async ask(libraryId: number, query: string, model: string = "gpt-3.5-turbo", stream: boolean = false, url: string = "https://api.aiproxy.io/api/library/ask", timeout: number = 90000): Promise<any> {
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

        const response = await axios.post(url, data, { headers, timeout });

        if (response.status !== 200 || response.data.success !== true) {
            throw new Error(response.data.message);
        }

        return response.data;
    }

    async editLibrary(libraryObj: Library): Promise<boolean> {
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
        const response = await axios.post(url, data, { headers: _headers });

        if (!this.respCheck(response)) {
            throw new Error(response.data.message);
        }

        return true;
    }

    async getLibrary(libraryId: number): Promise<[Library, any]> {
        const url = `${this.BASE_URL}/library/get`;
        const params = {
            libraryId
        };
        const _headers = {
            "Api-Key": this.apiKey
        };
        const response = await axios.get(url, { params, headers: _headers });

        if (!this.respCheck(response)) {
            throw new Error(response.data.message);
        }

        const data = response.data.data;
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

        return [libraryObj, data];
    }
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
