// ==UserScript==
// @name              网盘直链下载助手
// @namespace         https://github.com/syhyz1990/baiduyun
// @version           5.0.0
// @author            YouXiaoHou
// @icon              https://www.baiduyun.wiki/48x48.png
// @icon64            https://www.baiduyun.wiki/64x64.png
// @description       【网盘直链下载助手】是一款免费开源获取网盘文件真实下载地址的油猴插件，基于开放API，支持Windows，Mac，Linux等多平台，可使用IDM，Xdown等多线程加速工具加速下载，支持RPC协议远程下载。5.0版本支持更换皮肤。
// @license           AGPL
// @homepage          https://www.baiduyun.wiki
// @supportURL        https://github.com/syhyz1990/baiduyun
// @updateURL         https://www.baiduyun.wiki/panlinker.user.js
// @downloadURL       https://www.baiduyun.wiki/panlinker.user.js
// @match             *://pan.baidu.com/disk/home*
// @match             *://yun.baidu.com/disk/home*
// @match             *://pan.baidu.com/s/*
// @match             *://yun.baidu.com/s/*
// @match             *://pan.baidu.com/share/*
// @match             *://yun.baidu.com/share/*
// @require           https://cdn.jsdelivr.net/npm/jquery@3.2.1/dist/jquery.min.js
// @require           https://cdn.jsdelivr.net/npm/sweetalert2@10.15.5/dist/sweetalert2.all.min.js
// @connect           baidu.com
// @connect           baidupcs.com
// @connect           baiduyun.wiki
// @connect           localhost
// @connect           *
// @run-at            document-idle
// @grant             unsafeWindow
// @grant             GM_addStyle
// @grant             GM_xmlhttpRequest
// @grant             GM_setClipboard
// @grant             GM_setValue
// @grant             GM_getValue
// @grant             GM_openInTab
// @grant             GM_info
// @grant             GM_registerMenuCommand
// @grant             GM_cookie
// ==/UserScript==

(function () {
    'use strict';

    let pageType = '', selectFile = [], params = {}, yunData = {}, mode = '', width = 800, pan = {}, color = '',doc = $(document);
    const scriptInfo = GM_info.script;
    const version = scriptInfo.version;
    const author = scriptInfo.author;

    let toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: false,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    let util = {
        clog(c1, c2, c3) {
            c1 = c1 ? c1 : '';
            c2 = c2 ? c2 : '';
            c3 = c3 ? c3 : '';
            console.group('[网盘直链下载助手]');
            console.log(c1, c2, c3);
            console.groupEnd();
        },
        getCookie(e) {
            let o, t;
            let n = document, c = decodeURI;
            return n.cookie.length > 0 && (o = n.cookie.indexOf(e + "="), -1 != o) ? (o = o + e.length + 1, t = n.cookie.indexOf(";", o), -1 == t && (t = n.cookie.length), c(n.cookie.substring(o, t))) : "";
        },
        getValue(name) {
            return GM_getValue(name);
        },
        setValue(name, value) {
            GM_setValue(name, value);
        },
        getStorage(key) {
            return localStorage.getItem(key);
        },
        setStorage(key, value) {
            return localStorage.setItem(key, value);
        },
        encode(str) {
            return btoa(unescape(encodeURIComponent(str)));
        },
        decode(str) {
            return decodeURIComponent(escape(atob(str)));
        },
        setBDUSS() {
            if (GM_cookie) {
                GM_cookie('list', {name: 'BDUSS'}, (cookies, error) => {
                    if (!error) {
                        this.setStorage("baiduyunPlugin_BDUSS", JSON.stringify({BDUSS: cookies[0].value}));
                    }
                });
            }
        },
        getBDUSS() {
            let baiduyunPlugin_BDUSS = this.getStorage('baiduyunPlugin_BDUSS') ? this.getStorage('baiduyunPlugin_BDUSS') : '{"baiduyunPlugin_BDUSS":""}';
            let BDUSS = JSON.parse(baiduyunPlugin_BDUSS).BDUSS || '';
            return BDUSS;
        },
        convertToAria(link, filename, ua) {
            let BDUSS = this.getBDUSS();
            filename = filename.replace(' ', '_');
            if (BDUSS) {
                return encodeURIComponent(`aria2c "${link}" --out "${filename}" --header "User-Agent: ${ua}" --header "Cookie: BDUSS=${BDUSS}"`);
            } else {
                return {
                    link: pan.assistant,
                    text: pan.init[5]
                };
            }
        },
        message: {
            success(text) {
                toast.fire({title: text, icon: 'success'});
            },
            error(text) {
                toast.fire({title: text, icon: 'error'});
            },
            warning(text) {
                toast.fire({title: text, icon: 'warning'});
            },
            info(text) {
                toast.fire({title: text, icon: 'info'});
            },
            question(text) {
                toast.fire({title: text, icon: 'question'});
            }
        },
        post(url, data, headers, type, extra) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "POST", url, headers, data,
                    responseType: type || 'json',
                    onload: (res) => {
                        if (type === 'blob') {
                            const url = URL.createObjectURL(res.response);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = extra.filename;
                            a.click();
                        }
                        resolve(res.response || res.responseText);
                    },
                    onerror: (err) => {
                        reject(err);
                    },
                });
            });
        },
        get(url, headers, type, extra) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET", url, headers,
                    responseType: type || 'json',
                    onload: (res) => {
                        if (type === 'blob') {
                            const url = URL.createObjectURL(res.response);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = extra.filename;
                            a.click();
                        }
                        resolve(res.response || res.responseText);
                    },
                    onerror: (err) => {
                        reject(err);
                    },
                });
            });
        },
        head(url, headers, type, extra) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "HEAD", url, headers,
                    responseType: type || 'json',
                    onload: (res) => {
                        if (type === 'blob') {
                            const url = URL.createObjectURL(res.response);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = extra.filename;
                            a.click();
                        }
                        resolve(res.response || res.responseText);
                    },
                    onerror: (err) => {
                        reject(err);
                    },
                });
            });
        },
    };

    let main = {
        /**
         * 配置默认值
         */
        initValue() {
            let value = [{
                name: 'setting_rpc_domain',
                value: 'http://localhost'
            }, {
                name: 'setting_rpc_port',
                value: '16800'
            }, {
                name: 'setting_rpc_token',
                value: ''
            }, {
                name: 'setting_rpc_dir',
                value: 'D:'
            }, {
                name: 'setting_theme_color',
                value: '#09AAFF'
            }, {
                name: 'setting_init_code',
                value: ''
            }];

            value.forEach((v) => {
                if (util.getValue(v.name) === undefined) {
                    util.setValue(v.name, v.value);
                }
            });
        },

        addStyle() {
            color = util.getValue('setting_theme_color');
            GM_addStyle(`
            .panlinker-popup { font-size: 12px !important; }
            .panlinker-popup a { color: ${color} !important; }
            .panlinker-header { padding: 0;align-items: flex-start; border-bottom: 1px solid #eee; margin: 0 0 10px; padding: 0 0 5px;}
            .panlinker-title { font-size: 16px; line-height: 1;white-space: nowrap; text-overflow: ellipsis;}
            .panlinker-content { padding: 0; font-size: 12px}
            .panlinker-main { max-height: 400px;overflow-y:scroll}
            .panlinker-footer {font-size: 12px;justify-content: flex-start; margin: 10px 0 0; padding: 5px 0 0; color: #f56c6c}
            .panlinker-item { display: flex; align-items: center; line-height: 22px; }
            .panlinker-item-title { flex: 0 0 150px; text-align: left;margin-right: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
            .panlinker-item-link { flex: 1; overflow: hidden;text-align: left; white-space: nowrap; text-overflow: ellipsis; }
            .panlinker-btn-primary { background: ${color}; border: 0; border-radius: 4px; color: #ffffff; cursor: pointer; font-size: 12px; outline: none; display:flex; align-items: center; justify-content: center; margin: 2px 0; padding: 6px 0;transition: 0.3s opacity; }
            .panlinker-btn-info { background: #606266; }
            .panlinker-btn-primary:hover { opacity: 0.9;transition: 0.3s opacity; }
            .panlinker-btn-danger { background: #cc3235; }
            .element-clicked { opacity: 0.5; }
            .panlinker-extra { margin-top: 10px;display:flex}
            .panlinker-extra button { flex: 1}
            .pointer { cursor:pointer }
            .panlinker-setting-label { display: flex;align-items: center;justify-content: space-between;padding-top: 10px; }
            .panlinker-label { flex: 0 0 100px;text-align:left; }
            .panlinker-input { flex: 1; padding: 8px 10px; border: 1px solid #c2c2c2; border-radius: 5px; font-size: 14px }
            .panlinker-close:focus { outline: 0; box-shadow: none; }
            `);

        },

        addPageListener() {
            doc.on('click', '#panlinker-button', () => {
                $('#panlinker-button').addClass('button-open');
            });
            doc.on('mouseleave', '#panlinker-button', () => {
                $('#panlinker-button').removeClass('button-open');
            });
            doc.on('click', '.panlinker-button-mode', (e) => {
                Swal.showLoading();
                mode = e.target.dataset.mode;
                this.getPCSLink();
            });
            doc.on('click', '.panlistener-link-api', (e) => {
                e.preventDefault();
                $(e.target).animate({opacity: '0.5'}, "slow");
                util.get(e.target.dataset.link, {"User-Agent": pan.ua}, 'blob', {filename: e.target.dataset.filename});
            });
            doc.on('click', '.panlistener-link-aria, .panlistener-copy-aria', (e) => {
                e.preventDefault();
                if (e.target.dataset.link === '') {
                    $(e.target).removeClass('panlistener-copy-aria').addClass('panlinker-btn-danger').html(`${pan.init[5]}👉<a href="${pan.assistant}" target="_blank">点击此处安装</a>👈`);
                } else {
                    GM_setClipboard(decodeURIComponent(e.target.dataset.link), 'text');
                    $(e.target).text('复制成功，快去粘贴吧！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.panlistener-link-rpc', async (e) => {
                let res = await this.sendLinkToRPC(e.target.dataset.filename, e.target.dataset.link);
                let target = $(e.target).parents('.panlinker-item').find('.panlistener-link-rpc');
                if (res === 'success') {
                    target.removeClass('panlinker-btn-danger').text('发送成功，快去看看吧！').animate({opacity: '0.5'}, "slow");
                } else if (res === 'assistant') {
                    target.addClass('panlinker-btn-danger').html(`${pan.init[5]}👉<a href="${pan.assistant}" target="_blank">点击此处安装</a>👈`);
                } else {
                    target.addClass('panlinker-btn-danger').text('发送失败，请检查您的RPC配置信息！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.panlistener-send-rpc', (e) => {
                $('.panlistener-link-rpc').click();
                $(e.target).text('发送完成，发送结果见上方按钮！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.panlistener-config-rpc', (e) => {
                this.showSetting();
            });
        },

        /**
         * 添加按钮
         */
        addButton() {
            this._initVariable();
            pageType = this._detectPage();
            if (pageType !== 'home' && pageType !== 'share') return;
            let $toolWrap;
            pageType === 'home' ? $toolWrap = $('.tcuLAu') : $toolWrap = $('.module-share-top-bar .x-button-box');
            let $button = $(`<span class="g-dropdown-button pointer" id="panlinker-button"><a style="color:#fff;background: ${color};border-color:${color}" class="g-button g-button-blue" href="javascript:;"><span class="g-button-right"><em class="icon icon-download"></em><span class="text" style="width: 60px;">下载助手</span></span></a><span class="menu" style="width:auto;z-index:41;border-color:${color}"><a style="color:${color}" class="g-button-menu panlinker-button-mode" data-mode="api" href="javascript:;">API下载</a><a style="color:${color}" class="g-button-menu panlinker-button-mode" data-mode="aria" href="javascript:;" >Aria下载</a><a style="color:${color}" class="g-button-menu panlinker-button-mode" data-mode="rpc" href="javascript:;">RPC下载</a>${pan.code === 200 ? pan.new : ''}</span></span>`);
            $toolWrap.append($button);

            this.addPageListener();
        },

        /**
         * 获取链接
         * @returns {Promise<void>}
         */
        async getPCSLink() {
            selectFile = this.getSelctedFile();
            let fid_list = this._getFidList(), url, res;
            if (pageType === 'home') {
                if (selectFile.length === 0) {
                    return util.message.error('提示：请先勾选要下载的文件！');
                }
                fid_list = encodeURIComponent(fid_list);
                url = `${pan.pcs[0]}&fsids=${fid_list}`;
                res = await util.get(url, {"User-Agent": pan.ua});
            }
            if (pageType === 'share') {
                if (!params.bdstoken) {
                    return util.message.error('提示：登录网盘后才能使用此功能哦！');
                }
                if (selectFile.length === 0) {
                    return util.message.error('提示：请先勾选要下载的文件！');
                }
                let logid = this._getLogID();
                let formData = new FormData();
                formData.append('encrypt', params.encrypt);
                formData.append('product', params.product);
                formData.append('uk', params.uk);
                formData.append('primaryid', params.primaryid);
                formData.append('fid_list', fid_list);
                params.shareType == 'secret' ? formData.append('extra', params.extra) : '';
                url = `${pan.pcs[1]}&sign=${params.sign}&timestamp=${params.timestamp}&logid=${logid}`;
                res = await util.post(url, formData);
            }
            if (res.errno === 0) {
                let html = this.generateDom(res.list);
                this.showDialog(pan[mode][0], html, pan[mode][1]);
            } else if (res.errno === 112) {
                return util.message.error('提示：页面过期，请刷新重试！');
            } else {
                util.message.error('提示：获取下载链接失败！请刷新网页后重试！');
            }
        },

        /**
         * 生成Dom元素
         * @param list
         * @returns {string}
         */
        generateDom(list) {
            let content = '<div class="panlinker-main">';
            let alinkAllText = '';
            list.forEach((v) => {
                if (v.isdir === 1) return;
                let filename = v.server_filename || v.filename;
                let dlink = v.dlink;
                if (mode === 'api') {
                    content += `<div class="panlinker-item">
                                <div class="panlinker-item-title" title="${filename}">${filename}</div>
                                <a class="panlinker-item-link panlistener-link-api" href="${dlink}" data-filename="${filename}" data-link="${dlink}">${dlink}</a> </div>`;
                }
                if (mode === 'aria') {
                    let alink = util.convertToAria(dlink, filename, pan.ua);
                    if (typeof (alink) === 'object') {
                        content += `<div class="panlinker-item">
                                <div class="panlinker-item-title" title="${filename}">${filename}</div>
                                <a class="panlinker-item-link" target="_blank" href="${alink.link}" alt="点击复制aria2c链接" data-filename="${filename}" data-link="${alink.link}">${decodeURIComponent(alink.text)}</a> </div>`;
                    } else {
                        alinkAllText += alink + '\r\n';
                        content += `<div class="panlinker-item">
                                <div class="panlinker-item-title" title="${filename}">${filename}</div>
                                <a class="panlinker-item-link panlistener-link-aria" href="${alink}" alt="点击复制aria2c链接" data-filename="${filename}" data-link="${alink}">${decodeURIComponent(alink)}</a> </div>`;
                    }
                }
                if (mode === 'rpc') {
                    content += `<div class="panlinker-item">
                                <div class="panlinker-item-title" title="${filename}">${filename}</div>
                                <button class="panlinker-item-link panlistener-link-rpc panlinker-btn-primary panlinker-btn-info" data-filename="${filename}" data-link="${dlink}"><em class="icon icon-device"></em><span style="margin-left: 5px;">推送到RPC下载器</span></button></div>`;
                }
            });
            content += '</div>';
            if (mode === 'aria')
                content += `<div class="panlinker-extra"><button class="panlinker-btn-primary panlistener-copy-aria" data-link="${alinkAllText}">复制全部链接</button></div>`;
            if (mode === 'rpc')
                content += '<div class="panlinker-extra"><button class="panlinker-btn-primary  panlistener-send-rpc">发送全部链接</button><button class="panlinker-btn-primary panlistener-config-rpc" style="margin-left: 10px;">配置RPC服务</button></div>';
            return content;
        },

        async sendLinkToRPC(filename, link) {
            let rpc = {
                domain: util.getValue('setting_rpc_domain'),
                port: util.getValue('setting_rpc_port'),
                token: util.getValue('setting_rpc_token'),
                dir: util.getValue('setting_rpc_dir'),
            };
            let BDUSS = util.getBDUSS();
            if (!BDUSS) return 'assistant';

            let url = `${rpc.domain}:${rpc.port}/jsonrpc`;
            let json_rpc = {
                id: new Date().getTime(),
                jsonrpc: '2.0',
                method: 'aria2.addUri',
                params: [`token:${rpc.token}`, [link], {
                    dir: rpc.dir,
                    out: filename,
                    header: [`User-Agent: ${pan.ua}`, `Cookie: BDUSS=${BDUSS}`]
                }]
            };
            try {
                let res = await util.post(url, JSON.stringify(json_rpc), {"User-Agent": pan.ua}, '');
                if (res.result) return 'success';
                return 'fail';
            } catch (e) {
                return 'fail';
            }
        },

        /**
         * 获取选中文件列表
         * @returns {*}
         */
        getSelctedFile() {
            return require('system-core:context/context.js').instanceForSystem.list.getSelected();
        },

        _detectPage() {
            let regx = /[\/].+[\/]/g;
            let page = location.pathname.match(regx);
            let path = page[0].replace(/\//g, '');
            if (path === 'disk') return 'home';
            if (path === 's' || path === 'share') return 'share';
            return '';
        },

        /**
         * 初始化变量
         */
        _initVariable() {
            util.setBDUSS();
            yunData = unsafeWindow.yunData;
            params.shareType = this._getShareType();
            params.sign = yunData.SIGN;
            params.timestamp = yunData.TIMESTAMP;
            params.bdstoken = yunData.MYBDSTOKEN;
            params.channel = 'chunlei';
            params.clienttype = 0;
            params.web = 1;
            params.app_id = 250528;
            params.logid = this._getLogID();
            params.encrypt = 0;
            params.product = 'share';
            params.primaryid = yunData.SHARE_ID;
            params.uk = yunData.SHARE_UK;
            if (params.shareType === 'secret') {
                params.extra = this._getExtra();
            }
            if (!this._isSingleShare()) {
                params.shareid = yunData.SHARE_ID;
            }
        },

        _getLogID() {
            let name = "BAIDUID";
            let u = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/~！@#￥%……&";
            let d = /[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g;
            let f = String.fromCharCode;
            function l(e) {
                if (e.length < 2) {
                    let n = e.charCodeAt(0);
                    return 128 > n ? e : 2048 > n ? f(192 | n >>> 6) + f(128 | 63 & n) : f(224 | n >>> 12 & 15) + f(128 | n >>> 6 & 63) + f(128 | 63 & n);
                }
                let n = 65536 + 1024 * (e.charCodeAt(0) - 55296) + (e.charCodeAt(1) - 56320);
                return f(240 | n >>> 18 & 7) + f(128 | n >>> 12 & 63) + f(128 | n >>> 6 & 63) + f(128 | 63 & n);
            }
            function g(e) {
                return (e + "" + Math.random()).replace(d, l);
            }
            function m(e) {
                let n = [0, 2, 1][e.length % 3];
                let t = e.charCodeAt(0) << 16 | (e.length > 1 ? e.charCodeAt(1) : 0) << 8 | (e.length > 2 ? e.charCodeAt(2) : 0);
                let o = [u.charAt(t >>> 18), u.charAt(t >>> 12 & 63), n >= 2 ? "=" : u.charAt(t >>> 6 & 63), n >= 1 ? "=" : u.charAt(63 & t)];
                return o.join("");
            }
            function h(e) {
                return e.replace(/[\s\S]{1,3}/g, m);
            }
            function p() {
                return h(g((new Date()).getTime()));
            }
            function w(e, n) {
                return n ? p(String(e)).replace(/[+\/]/g, (e) => {
                    return "+" == e ? "-" : "_";
                }).replace(/=/g, "") : p(String(e));
            }
            return w(util.getCookie(name));
        },

        _getShareType() {
            return yunData.SHARE_PUBLIC === 1 ? 'public' : 'secret';
        },

        _isSingleShare() {
            return yunData.SHAREPAGETYPE === "single_file_page";
        },

        _getExtra() {
            let seKey = decodeURIComponent(util.getCookie('BDCLND'));
            return '{' + '"sekey":"' + seKey + '"' + "}";
        },

        _getFidList() {
            let fidlist = [];
            selectFile.forEach(v => {
                if (v.isdir == 1) return;
                fidlist.push(v.fs_id);
            });
            return '[' + fidlist + ']';
        },

        showDialog(title, html, footer) {
            Swal.fire({
                title,
                html,
                footer,
                allowOutsideClick: false,
                showCloseButton: true,
                showConfirmButton: false,
                position: 'top',
                width: 800,
                padding: '15px 20px 5px',
                customClass: {
                    container: 'panlinker-container',
                    popup: 'panlinker-popup',
                    header: 'panlinker-header',
                    title: 'panlinker-title',
                    closeButton: 'panlinker-close',
                    icon: 'panlinker-icon',
                    image: 'panlinker-image',
                    content: 'panlinker-content',
                    htmlContainer: 'panlinker-html',
                    input: 'panlinker-input',
                    inputLabel: 'panlinker-inputLabel',
                    validationMessage: 'panlinker-validation',
                    actions: 'panlinker-actions',
                    confirmButton: 'panlinker-confirm',
                    denyButton: 'panlinker-deny',
                    cancelButton: 'panlinker-cancel',
                    loader: 'panlinker-loader',
                    footer: 'panlinker-footer'
                },
            });
        },

        async getPanLinker() {
            let res = await util.post
            (`https://api.baiduyun.wiki/upgrade?ver=${version}&a=${author}`, {}, {}, 'text');
            pan = JSON.parse(util.decode(res));
            await this._initDialog();
            util.clog('下载助手加载成功！当前版本：', version);
        },

        async _initDialog() {
            if (pan.num === util.getValue('setting_init_code')) {
                this.addButton();
            } else {
                let result = await Swal.fire({
                    title: pan.init[0],
                    html: $(`<div><img style="width: 250px;margin-bottom: 10px;" src="${pan.img}"><input class="swal2-input" id="init" type="text" placeholder="${pan.init[1]}"></div>`)[0],
                    allowOutsideClick: false,
                    showCloseButton: true,
                    confirmButtonText: '确定'
                });
                if (result.isDismissed && result.dismiss === 'close') return;
                if (pan.num === $('#init').val()) {
                    util.setValue('setting_init_code', pan.num);
                    util.message.success(pan.init[2]);
                    setTimeout(() => {
                        history.go(0);
                    }, 1500);
                } else {
                    await Swal.fire({
                        title: pan.init[3],
                        text: pan.init[4],
                        confirmButtonText: '重新输入',
                        imageUrl: pan.img,
                    });
                    this._initDialog();
                }
            }
        },

        registerMenuCommand() {
            GM_registerMenuCommand('设置', () => {
                this.showSetting();
            });

            GM_registerMenuCommand(`当前版本：v${version}`, () => {
                GM_openInTab('https://www.baiduyun.wiki/install.html', {active: true});
            });
        },

        showSetting() {
            let dom = '', btn = '', colorList = ['#09AAFF', '#cc3235', '#574ab8', '#518c17', '#ed944b', '#f969a5', '#bca280'];
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">RPC主机</div><input type="text"  placeholder="主机地址，需带上http(s)://" class="panlinker-input panlistener-domain" value="${util.getValue('setting_rpc_domain')}"></label>`;
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">RPC端口</div><input type="text" placeholder="端口号，例如：Motrix为16800" class="panlinker-input panlistener-port" value="${util.getValue('setting_rpc_port')}"></label>`;
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">RPC密钥</div><input type="text" placeholder="无密钥无需填写" class="panlinker-input panlistener-token" value="${util.getValue('setting_rpc_token')}"></label>`;
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">保存路径</div><input type="text" placeholder="文件下载后保存路径，例如：D:" class="panlinker-input panlistener-dir" value="${util.getValue('setting_rpc_dir')}"></label>`;

            colorList.forEach((v) => {
                btn += `<div data-color="${v}" style="background: ${v};width: 35px;height: 35px;margin:0 10 10 0" class="pointer panlistener-color"></div>`;
            });
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">主题颜色</div> <div style="flex: 1;display: flex;flex-wrap: wrap;
                 margin-right: -10px;">${btn}<div></label>`;
            dom = '<div>' + dom + '</div>';

            Swal.fire({
                title: '助手配置',
                html: dom,
                icon: 'info',
                showCloseButton: true,
                showConfirmButton: false,
                footer: pan.footer,
            });

            doc.on('click', '.panlistener-color', async (e) => {
                util.setValue('setting_theme_color', e.target.dataset.color);
                util.message.success('设置成功！');
                history.go(0);
            });
            doc.on('input', '.panlistener-domain', async (e) => {
                util.setValue('setting_rpc_domain', e.target.value);
            });
            doc.on('input', '.panlistener-port', async (e) => {
                util.setValue('setting_rpc_port', e.target.value);
            });
            doc.on('input', '.panlistener-token', async (e) => {
                util.setValue('setting_rpc_token', e.target.value);
            });
            doc.on('input', '.panlistener-dir', async (e) => {
                util.setValue('setting_rpc_dir', e.target.value);
            });
        },

        init() {
            this.initValue();
            this.addStyle();
            this.getPanLinker();
            this.registerMenuCommand();
        }
    };

    main.init();
})();
