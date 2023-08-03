import * as React from 'react';
import {useCallback, useState} from 'react';

// import './styles.css';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight'
import AIPLibrary from "./aiproxy-api";
import {g_app, g_settings} from "./main";
// import SendIcon from '@mui/icons-material/Send';
import {Send as SendIcon} from "@mui/icons-material";
// import LoadingButton from '@mui/lab/LoadingButton';
import {LoadingButton} from '@mui/lab';
// import TextField from '@mui/material/TextField';
// import Grid from '@mui/material';
import {Grid, TextField} from "@mui/material";


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
        }else if (response.errMsg) {
            assistantMessage.content = response.errMsg;
        }else {
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

    return (
        <div className="chat-view">
            <div className="chat-view__history">
                {history.map((message, index) => {
                    const isLast = index === history.length - 1;
                    const isUser = message.role === Role.User;
                    const isAssistant = message.role === Role.Assistant;
                    const isThinking = message.thinking;
                    return (
                        <div
                            key={index}
                            className={`chat-view__message ${
                                isUser ? 'chat-view__message--user' : ''
                            } ${isAssistant ? 'chat-view__message--assistant' : ''}`}
                        >
                            <div className="chat-view__message-content">
                                {isThinking ? (
                                    // <Text type="secondary">Thinking...</Text>
                                    <div className="thinking">Thinking...</div>
                                ) : (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeHighlight]}
                                        children={message.content}
                                        transformLinkUri={uri => {
                                            if (uri.startsWith('obsidian://')) {
                                                return `javascript:window.open('${uri}','_blank')`;
                                            }
                                            return uri;
                                        }}
                                    />
                                )}
                            </div>
                            {/*{isLast && isUser && (*/}
                            {/*    <div className="chat-view__message-status">*/}
                            {/*        <Text type="secondary">Sent</Text>*/}
                            {/*    </div>*/}
                            {/*)}*/}
                        </div>
                    );
                })}
            </div>
            <div className="chat-view__footer">
                <Grid container spacing={2}>
                    <Grid item xs={10}>
                        <TextField
                            id="outlined-textarea"
                            label="输入框"
                            placeholder="今天你想问点什么？"
                            multiline
                            value={query}
                            onChange={event => {setQuery(event.target.value)}}
                        />
                    </Grid>
                    <Grid item xs={2}>
                        <LoadingButton
                            onClick={getAnswer}
                            endIcon={<SendIcon />}
                            loading={thinking}
                            loadingPosition="end"
                            variant="contained"
                        >
                            Send
                        </LoadingButton>
                    </Grid>
                </Grid>
            </div>
        </div>
    );
}

export default ChatView;