import * as React from 'react';
import {useCallback, useState} from 'react';

import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight'
import { FaRegUser, FaRobot, FaRegCopy, FaPaperPlane, FaBookmark, FaRedo, FaTrash } from 'react-icons/fa';
import AIPLibrary from "./aiproxy-api";
import {g_app, g_settings} from "./main";
import TextareaAutosize from "react-textarea-autosize";
import {Notice} from "obsidian"

const enum Role {
    Assistant = 'assistant',
    User = 'user',
}

export interface SingleMessage {
    role: Role;
    content: string;
    timestamp: number;
    thinking?: boolean
}

interface DocNode {
    nodeId: string;
    libraryId: number;
    docId: string;
    text: string;
    score: number;
}


interface ReferDocument {
    docId: string;
    gmtCreate: string;
    libraryId: number;
    title: string;
    url?: string;
    nodes: DocNode[];
}


interface AskResponse {
    success: boolean;
    answer: string;
    embeddingElapsedMs: number;
    vectorSearchElapsedMs: number;
    retrieverElapsedMs: number;
    llmElapsedMs: number;
    totalElapsedMs: number;
    documents?: ReferDocument[];
}


function AddDocsIntoAnswer(answer: string, docs: ReferDocument[]) {
    if (docs.length === 0) {
        return answer;
    }
    let newAnswer = answer + "\n\n相关文档：";
    let num = 0;
    for (const doc of docs) {
        num++;
        const url = "obsidian://open?vault=" + encodeURIComponent(g_app.vault.getName()) + "&file=" + encodeURIComponent(doc.title);
        newAnswer += "\n" + num + `. [${doc.title}](${url})`;
    }
    console.log(newAnswer);
    return newAnswer;
}


function ChatView() {
    const [query, setQuery] = useState('');
    const [thinking, setThinking] = useState(false); // thinking状态，用于控制发送按钮的loading状态
    const [history, setHistory] = useState<SingleMessage[]>([]);
    const getAnswer = useCallback(async () => {
        if (!query) {
            return;
        }
        const newHistory = history.concat({
            role: Role.User,
            content: query,
            timestamp: Date.now(),
        });
        const assistantMessage = { // 创建一个助手的消息，并且初始thinking状态为true
            role: Role.Assistant,
            content: '',
            timestamp: Date.now(),
            thinking: true,
        }
        setHistory(newHistory.concat(assistantMessage));
        setQuery('');
        setThinking(true); // 请求开始后，把助手的thinking状态设为true
        const AIP = new AIPLibrary(g_settings.apiKey);
        const response = await AIP.ask(g_settings.libraryNumber, query, g_settings.modelName, false, g_settings.aiproxyAskUrl);
        let data: AskResponse
        if (response.success) {
            data = response.data;
            assistantMessage.content = AddDocsIntoAnswer(data.answer, data.documents || []);
        } else if (response.errMsg) {
            assistantMessage.content = response.errMsg;
        } else {
            assistantMessage.content = "未知错误";
        }
        assistantMessage.thinking = false; // 请求结束后，把助手的thinking状态设为false
        setHistory(prevHistory => {
            const historyCopy = [...prevHistory];
            historyCopy[historyCopy.length - 1] = assistantMessage; // 替换最后一个消息
            return historyCopy;
        });
        setThinking(false); // 请求结束后，把助手的thinking状态设为false

    }, [query]);

    const handleKeyDown = useCallback(
        (e: { key: string; }) => {
            if (e.key === 'Enter') {
                getAnswer().then();
            }
        },
        [getAnswer],
    );

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            new Notice("已复制到剪贴板");
        })
    };

    const handleImport = async () => {
        if (history.length === 0) {
            new Notice("没有聊天记录");
            return;
        }
        let content = "";
        for (const msg of history) {
            if (msg.role === Role.Assistant) {
                content += "**AI**: " + msg.content + "\n\n";
            }
            if (msg.role === Role.User) {
                content += "**User**: " + msg.content + "\n\n";
            }
        }
        const formatNowTime = () => {
            const now = new Date();
            return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        }
        const tf = await g_app.vault.create("Chat  " + formatNowTime() + ".md", content)
        const activeLeaf = g_app.workspace.getLeaf();
        if (!activeLeaf) {
            console.warn('No active leaf');
            return;
        }
        await activeLeaf.openFile(tf, { state: { mode: 'source' } });
        new Notice("导入成功");
    };

    const handleRegenerate = async () => {
        let lastQuery = history[history.length - 1];
        if (lastQuery && lastQuery.role === Role.User) {
            setQuery(lastQuery.content);
            await getAnswer();
            return
        }
        lastQuery = history[history.length - 2]; // 两次，最多查两次一定能查到
        if (lastQuery && lastQuery.role === Role.User) {
            setQuery(lastQuery.content);
            await getAnswer();
            return
        }
    };

    const handleClear = () => {
        setHistory([]);
    };

    return (
        <div className="relative bg-inherit h-screen overflow-hidden">
            <div className="absolute inset-x-0 top-0 overflow-y-auto z-10 bottom-72">
                {history.map((msg, i) => (
                    <div key={i} className="flex items-start space-x-2 mb-4">
                        <div className="flex-shrink-0">
                            {msg.role === 'user' ? <FaRegUser className="text-blue-500"/> : <FaRobot className="text-green-500"/>}
                        </div>
                        <div className="border rounded p-2 bg-inherit relative select-text overscroll-contain">
                            {msg.thinking ? (
                                <div className="thinking">Thinking...</div>
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[gfm]}
                                    rehypePlugins={[rehypeHighlight]}
                                    children={msg.content}
                                    transformLinkUri={(uri) => {
                                        if (uri.startsWith('obsidian://')) {
                                            return `javascript:window.open('${uri}','_blank')`;
                                        }
                                        return uri;
                                    }}
                                />
                            )}
                        </div>
                        <button onClick={() => handleCopy(msg.content)} className="p-1 text-gray-500">
                            <FaRegCopy />
                        </button>
                    </div>
                ))}
            </div>
            <div className="fixed inset-x-0 bottom-24 m-2 flex justify-around space-x-1 p-2 bg-inherit z-30">
                <button onClick={handleImport} className="p-2 text-gray-500" title="将聊天记录导入到新笔记">
                    <FaBookmark />
                </button>
                <button onClick={handleRegenerate} className="p-2 text-gray-500" title="重新生成">
                    <FaRedo />
                </button>
                <button onClick={handleClear} className="p-2 text-gray-500" title="清空聊天记录">
                    <FaTrash />
                </button>
            </div>
            <div className="fixed inset-x-0 bottom-0 m-2 flex items-center justify-between p-3 bg-inherit z-40">
                <div className="flex-grow mr-3">
                    <TextareaAutosize
                        className="w-full p-2 border-2 border-gray-400 resize-none focus:outline-none transition-all duration-150 ease-in-out bg-inherit dark:text-white"
                        minRows={2}
                        maxRows={3} // 通过限制最多行数避免组件重叠，请叫我天才~
                        placeholder="今天你想问点什么？"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <button onClick={getAnswer} disabled={thinking} className={`p-2 rounded ${thinking ? 'bg-gray-500 cursor-default' : 'bg-blue-500 hover:bg-blue-700'} text-black`}>
                    {thinking ? 'Thinking...' : 'Send'} <FaPaperPlane />
                </button>
            </div>
        </div>
    );





}

export default ChatView;