import {createRoot} from "react-dom/client";
import {ItemView, WorkspaceLeaf} from "obsidian";
import {VIEW_TYPE} from "./constants";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ChatView from "./chat-view";

export class ChatViewType extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return "aiproxy chat interface";
    }

    async onOpen() {
        const root = createRoot(this.containerEl.children[1]);
        root.render(
            <React.StrictMode>
                <ChatView />
            </React.StrictMode>
        );
    }

    async onClose() {
        ReactDOM.unmountComponentAtNode(this.containerEl.children[1]);
    }
}