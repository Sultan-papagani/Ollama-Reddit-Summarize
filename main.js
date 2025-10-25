// ==UserScript==
// @name         Reddit Post Summarizer with Ollama & Model Dropdown
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Summarize Reddit posts with Ollama, select model from dropdown
// @match        https://www.reddit.com/*
// @grant        GM.xmlHttpRequest
// @connect      127.0.0.1
// @connect      127.0.0.1:11434
// ==/UserScript==

(function() {
    'use strict';

    const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
    const TAGS_URL = 'http://127.0.0.1:11434/api/tags';

    let selectedModel = localStorage.getItem('ollama_model') || 'granite3.1-moe';
    let availableModels = [];

    function fetchModels(callback) {
        GM.xmlHttpRequest({
            method: 'GET',
            url: TAGS_URL,
            onload: function(res) {
                if (res.status >= 200 && res.status < 300) {
                    try {
                        const data = JSON.parse(res.responseText);
                        availableModels = data.models.map(m => m.name);
                        if (!availableModels.includes(selectedModel)) selectedModel = availableModels[0];
                        localStorage.setItem('ollama_model', selectedModel);
                        callback();
                    } catch (e) {
                        console.error('Failed to parse models', e);
                    }
                }
            },
            onerror: function(err) {
                console.error('Failed to fetch models', err);
            }
        });
    }

    function collectText(container) {
        const paragraphs = Array.from(container.querySelectorAll('p, li'));
        return paragraphs.map(p => p.innerText.trim()).join('\n');
    }

function summarizePost(container) {
    appendSummary(container, null); // show loading

    const textToSummarize = collectText(container);
    if (!textToSummarize) return;

    const payload = {
        model: selectedModel,
        //summarize the following text very shortly:
        prompt: " Very shortly summarize the following text: " + textToSummarize,
        stream: false
    };

    GM.xmlHttpRequest({
        method: 'POST',
        url: OLLAMA_URL,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(payload),
        onload: function(res) {
            if (res.status >= 200 && res.status < 300) {
                try {
                    const obj = JSON.parse(res.responseText);
                    let summary = obj?.response || 'No response field found';
                    // Format Markdown bold and line breaks
                    summary = summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                    appendSummary(container, summary);
                } catch (e) {
                    console.error('Failed to parse Ollama response:', e, res.responseText);
                    appendSummary(container, 'Ollama is not running');
                }
            } else {
                console.error('Ollama error:', res.status, res.statusText);
                appendSummary(container, 'Ollama is not running');
            }
        },
        onerror: function(err) {
            console.error('Ollama request failed:', err);
            appendSummary(container, 'Ollama is not running');
        }
    });
}

    function appendSummary(container, summary = null) {
    // Check for existing summary outside the container
    let summaryEl = container.nextElementSibling;
    if (!summaryEl || !summaryEl.classList.contains('tm-ollama-summary')) {
        summaryEl = document.createElement('div');
        summaryEl.className = 'tm-ollama-summary';
        summaryEl.style.backgroundColor = '#f0f0f0';
        summaryEl.style.padding = '10px';
        summaryEl.style.borderRadius = '8px';
        summaryEl.style.border = '1px solid #ccc';
        summaryEl.style.marginTop = '10px';
        summaryEl.style.whiteSpace = 'pre-wrap';
        summaryEl.style.position = 'relative';
        summaryEl.style.width = '100%';
        summaryEl.style.clear = 'both';

        // Header with dropdown
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.marginBottom = '5px';

        const title = document.createElement('span');
        title.innerHTML = '✨ <strong>Usefull AI Summarization</strong>';
        title.style.fontSize = '14px';

        const select = document.createElement('select');
        select.style.fontSize = '10px';
        select.style.padding = '2px';
        select.style.height = '26px';
        select.style.minWidth = '60px';
        select.style.maxWidth = '150px';
        select.style.overflow = 'hidden';
        select.style.textOverflow = 'ellipsis';
        select.style.whiteSpace = 'nowrap';

        availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            if (model === selectedModel) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            selectedModel = select.value;
            localStorage.setItem('ollama_model', selectedModel);
            content.innerHTML = 'Loading...';
            summarizePost(container);
        });

        header.appendChild(title);
        header.appendChild(select);

        // Content div
        const content = document.createElement('div');
        content.style.fontSize = '13px';
        content.innerHTML = summary ? summary : 'Loading...';

        summaryEl.appendChild(header);
        summaryEl.appendChild(content);

        // Insert summary **after the container** (as a sibling)
        container.insertAdjacentElement('afterend', summaryEl);
    } else {
        const content = summaryEl.querySelector('div:nth-child(2)');
        content.innerHTML = summary ? summary : 'Loading...';
    }
}

    function init() {
    // Only run on a post page
    if (!window.location.pathname.includes('/comments/')) return;

    fetchModels(() => {
        const observer = new MutationObserver(() => {
            const postContainers = document.querySelectorAll('shreddit-post-text-body');
            postContainers.forEach(container => {
                // Skip if already summarized
                if (container.dataset.summarized) return;

                // Skip if container is inside the feed (main page)
                if (container.closest('shreddit-feed')) return;

                container.dataset.summarized = 'true';
                summarizePost(container);
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

    init();
})();
