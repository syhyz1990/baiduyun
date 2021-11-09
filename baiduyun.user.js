// ==UserScript==
// @name              网盘直链下载助手
// @namespace         https://github.com/syhyz1990/baiduyun
// @version           5.4.1
// @author            YouXiaoHou
// @icon              https://www.baiduyun.wiki/48x48.png
// @icon64            https://www.baiduyun.wiki/64x64.png
// @description       【网盘直链下载助手】是一款免费开源获取网盘文件真实下载地址的油猴插件，基于开放API，支持 Windows，Mac，Linux 等多平台，即可使用系统自带的终端 cURL 命令，也可以使用 IDM，Xdown 等多线程工具加速下载，支持 Aria RPC 协议远程下载。支持自定义更换皮肤和新版网盘界面。
// @license           AGPL-3.0
// @homepage          https://www.baiduyun.wiki
// @supportURL        https://github.com/syhyz1990/baiduyun
// @updateURL         https://www.baiduyun.wiki/panlinker.user.js
// @downloadURL       https://www.baiduyun.wiki/panlinker.user.js
// @match             *://pan.baidu.com/disk/home*
// @match             *://yun.baidu.com/disk/home*
// @match             *://pan.baidu.com/disk/main*
// @match             *://yun.baidu.com/disk/main*
// @match             *://pan.baidu.com/s/*
// @match             *://yun.baidu.com/s/*
// @match             *://pan.baidu.com/share/*
// @match             *://yun.baidu.com/share/*
// @require           https://cdn.jsdelivr.net/npm/jquery@3.2.1/dist/jquery.min.js
// @require           https://cdn.jsdelivr.net/npm/sweetalert2@10.16.6/dist/sweetalert2.all.min.js
// @connect           baidu.com
// @connect           baidupcs.com
// @connect           baiduyun.wiki
// @connect           localhost
// @connect           *
// @run-at            document-idle
// @grant             unsafeWindow
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

    let pt = '', selectList = [], params = {}, mode = '', width = 800, pan = {}, color = '',
        doc = $(document), progress = {}, request = {}, ins = {}, idm = {};
    const scriptInfo = GM_info.script;
    const version = scriptInfo.version;
    const author = scriptInfo.author;
    const name = scriptInfo.name;
    const customClass = {
        container: 'pl-container',
        popup: 'pl-popup',
        header: 'pl-header',
        title: 'pl-title',
        closeButton: 'pl-close',
        icon: 'pl-icon',
        image: 'pl-image',
        content: 'pl-content',
        htmlContainer: 'pl-html',
        input: 'pl-input',
        inputLabel: 'pl-inputLabel',
        validationMessage: 'pl-validation',
        actions: 'pl-actions',
        confirmButton: 'pl-confirm',
        denyButton: 'pl-deny',
        cancelButton: 'pl-cancel',
        loader: 'pl-loader',
        footer: 'pl-footer'
    };

    let toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: false,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    let util = {
        clog(c) {
            console.group(`[${name}]`);
            console.log(c);
            console.groupEnd();
        },
        getCookie(name) {
            let arr = document.cookie.replace(/\s/g, "").split(';');
            for (let i = 0, l = arr.length; i < l; i++) {
                let tempArr = arr[i].split('=');
                if (tempArr[0] === name) {
                    return decodeURIComponent(tempArr[1]);
                }
            }
            return '';
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
        setClipboard(text) {
            GM_setClipboard(text, 'text');
        },
        e(str) {
            return btoa(unescape(encodeURIComponent(str)));
        },
        d(str) {
            return decodeURIComponent(escape(atob(str)));
        },
        setBDUSS() {
            try {
                GM_cookie && GM_cookie('list', {name: 'BDUSS'}, (cookies, error) => {
                    if (!error) {
                        this.setStorage("baiduyunPlugin_BDUSS", JSON.stringify({BDUSS: cookies[0].value}));
                    }
                });
            } catch (e) {
            }
        },
        getBDUSS() {
            let baiduyunPlugin_BDUSS = this.getStorage('baiduyunPlugin_BDUSS') ? this.getStorage('baiduyunPlugin_BDUSS') : '{"baiduyunPlugin_BDUSS":""}';
            return JSON.parse(baiduyunPlugin_BDUSS).BDUSS || '';
        },
        getExtension(name) {
            const reg = /(?!\.)\w+$/;
            if (reg.test(name)) {
                let match = name.match(reg);
                return match[0].toUpperCase();
            }
            return '';
        },
        sizeFormat(value) {
            if (value === +value) {
                let unit = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
                let index = Math.floor(Math.log(value) / Math.log(1024));
                let size = value / Math.pow(1024, index);
                size = size.toFixed(1);
                return size + unit[index];
            }
            return '';
        },
        sortByName(arr) {
            const handle = () => {
                return  (a, b) => {
                    const p1 = a.filename ? a.filename : a.server_filename;
                    const p2 = b.filename ? b.filename : b.server_filename;
                    return p1.localeCompare(p2, "zh-CN");
                };
            };
            arr.sort(handle());
        },
        convertLinkToAria(link, filename, ua) {
            let BDUSS = util.getBDUSS();
            filename = filename.replace(' ', '_');
            if (!!BDUSS) {
                return encodeURIComponent(`aria2c "${link}" --out "${filename}" --header "User-Agent: ${ua}" --header "Cookie: BDUSS=${BDUSS}"`);
            }
            return {
                link: pan.assistant,
                text: pan.init[5]
            };
        },
        convertLinkToCurl(link, filename, ua) {
            let BDUSS = util.getBDUSS();
            filename = filename.replace(' ', '_');
            if (!!BDUSS) {
                return encodeURIComponent(`curl -L "${link}" --output "${filename}" -A "${ua}" -b "BDUSS=${BDUSS}"`);
            }
            return {
                link: pan.assistant,
                text: pan.init[5]
            };
        },
        blobDownload(blob, filename) {
            if (blob instanceof Blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
        },
        setInt(name, time) {
            time = time || 100;
            let i = 0;
            if ($(name).length) return;
            let ins = setInterval(() => {
                i++;
                if ($(name).length) {
                    clearInterval(ins);
                    $(name).remove();
                }
                if (i > 60) clearInterval(ins);
            }, time);
        },
        sleep(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
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
        post(url, data, headers, type) {
            if (Object.prototype.toString.call(data) === '[object Object]') {
                data = JSON.stringify(data);
            }
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "POST", url, headers, data,
                    responseType: type || 'json',
                    onload: (res) => {
                        type === 'blob' ? resolve(res) : resolve(res.response || res.responseText);
                    },
                    onerror: (err) => {
                        reject(err);
                    },
                });
            });
        },
        get(url, headers, type, extra) {
            return new Promise((resolve, reject) => {
                let requestObj = GM_xmlhttpRequest({
                    method: "GET", url, headers,
                    responseType: type || 'json',
                    onload: (res) => {
                        if (res.status === 204) {
                            requestObj.abort();
                            idm[extra.index] = true;
                        }
                        if (type === 'blob') {
                            res.status === 200 && util.blobDownload(res.response, extra.filename);
                            resolve(res);
                        } else {
                            resolve(res.response || res.responseText);
                        }
                    },
                    onprogress: (res) => {
                        if (extra && extra.filename && extra.index) {
                            res.total > 0 ? progress[extra.index] = (res.loaded * 100 / res.total).toFixed(2) : progress[extra.index] = 0.00;
                        }
                    },
                    onloadstart() {
                        extra && extra.filename && extra.index && (request[extra.index] = requestObj);
                    },
                    onerror: (err) => {
                        reject(err);
                    },
                });
            });
        },
        addStyle(id, tag, css) {
            tag = tag || 'style';
            let doc = document, styleDom = doc.getElementById(id);
            if (styleDom) return;
            let style = doc.createElement(tag);
            style.rel = 'stylesheet';
            style.id = id;
            tag === 'style' ? style.innerHTML = css : style.href = css;
            doc.getElementsByTagName('head')[0].appendChild(style);
        }
    };

    let panlinker = {
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
            }, {
                name: 'scode',
                value: ''
            }];

            value.forEach((v) => {
                util.getValue(v.name) === undefined && util.setValue(v.name, v.value);
            });
        },

        addStyle() {
            color = util.getValue('setting_theme_color');
            util.setInt('#panlinker-button');
            let css = `
            body::-webkit-scrollbar { display: none }
            ::-webkit-scrollbar { width: 6px; height: 10px }
            ::-webkit-scrollbar-track { border-radius: 0; background: none }
            ::-webkit-scrollbar-thumb { background-color: rgba(85,85,85,.4) }
            ::-webkit-scrollbar-thumb,::-webkit-scrollbar-thumb:hover { border-radius: 5px; -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,.2) }
            ::-webkit-scrollbar-thumb:hover { background-color: rgba(85,85,85,.3) }
            .pl-popup { font-size: 12px !important; }
            .pl-popup a { color: ${color} !important; }
            .pl-header { padding: 0!important;align-items: flex-start!important; border-bottom: 1px solid #eee!important; margin: 0 0 10px!important; padding: 0 0 5px!important; }
            .pl-title { font-size: 16px!important; line-height: 1!important;white-space: nowrap!important; text-overflow: ellipsis!important;}
            .pl-content { padding: 0 !important; font-size: 12px!important; }
            .pl-main { max-height: 400px;overflow-y:scroll; }
            .pl-footer {font-size: 12px!important;justify-content: flex-start!important; margin: 10px 0 0!important; padding: 5px 0 0!important; color: #f56c6c!important; }
            .pl-item { display: flex; align-items: center; line-height: 22px; }
            .pl-item-name { flex: 0 0 150px; text-align: left;margin-right: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; cursor:default; }
            .pl-item-link { flex: 1; overflow: hidden; text-align: left; white-space: nowrap; text-overflow: ellipsis; }
            .pl-item-tip { display: flex; justify-content: space-between;flex: 1; }
            .pl-back { width: 70px; background: #ddd; border-radius: 3px; cursor:pointer; margin:1px 0; }
            .pl-ext { display: inline-block; width: 44px; background: #999; color: #fff; height: 16px; line-height: 16px; font-size: 12px; border-radius: 3px;}
            .pl-retry {padding: 3px 10px; background: #cc3235; color: #fff; border-radius: 3px; cursor: pointer;}
            .pl-browserdownload { padding: 3px 10px; background: ${color}; color: #fff; border-radius: 3px; cursor: pointer;}
            .pl-item-progress { display:flex;flex: 1;align-items:center}
            .pl-progress { display: inline-block;vertical-align: middle;width: 100%; box-sizing: border-box;line-height: 1;position: relative;height:15px; flex: 1}
            .pl-progress-outer { height: 15px;border-radius: 100px;background-color: #ebeef5;overflow: hidden;position: relative;vertical-align: middle;}
            .pl-progress-inner{ position: absolute;left: 0;top: 0;background-color: #409eff;text-align: right;border-radius: 100px;line-height: 1;white-space: nowrap;transition: width .6s ease;}
            .pl-progress-inner-text { display: inline-block;vertical-align: middle;color: #d1d1d1;font-size: 12px;margin: 0 5px;height: 15px}
            .pl-progress-tip{ flex:1;text-align:right}
            .pl-progress-how{ flex: 0 0 90px; background: #ddd; border-radius: 3px; margin-left: 10px; cursor: pointer; text-align: center;}
            .pl-progress-stop{ flex: 0 0 50px; padding: 0 10px; background: #cc3235; color: #fff; border-radius: 3px; cursor: pointer;margin-left:10px;height:20px}
            .pl-progress-inner-text:after { display: inline-block;content: "";height: 100%;vertical-align: middle;}
            .pl-btn-primary { background: ${color}; border: 0; border-radius: 4px; color: #ffffff; cursor: pointer; font-size: 12px; outline: none; display:flex; align-items: center; justify-content: center; margin: 2px 0; padding: 6px 0;transition: 0.3s opacity; }
            .pl-btn-info { background: #606266; }
            .pl-button-init { opacity: 0.5; animation: easeInitOpacity 1.2s 3; animation-fill-mode:forwards }
            @keyframes easeInitOpacity { from { opacity: 0.5; } 50% { opacity: 1 } to { opacity: 0.5; } }
            .pl-btn-primary:hover { opacity: 0.9;transition: 0.3s opacity; }
            .pl-btn-danger { background: #cc3235; }
            .pl-btn-success { background: #55af28; animation: easeOpacity 1.2s 2; animation-fill-mode:forwards }
             @keyframes easeOpacity { from { opacity: 1; } 50% { opacity: 0.35 } to { opacity: 1; } }
            .element-clicked { opacity: 0.5; }
            .pl-extra { margin-top: 10px;display:flex}
            .pl-extra button { flex: 1}
            .pointer { cursor:pointer }
            .pl-setting-label { display: flex;align-items: center;justify-content: space-between;padding-top: 10px; }
            .pl-label { flex: 0 0 100px;text-align:left; }
            .pl-input { flex: 1; padding: 8px 10px; border: 1px solid #c2c2c2; border-radius: 5px; font-size: 14px }
            .pl-color { flex: 1;display: flex;flex-wrap: wrap; margin-right: -10px;}
            .pl-color-box { width: 35px;height: 35px;margin:10px 10px 0 0;; box-sizing: border-box;border:1px solid #fff;cursor:pointer }
            .pl-color-box.checked { border:3px dashed #111!important }
            .pl-close:focus { outline: 0; box-shadow: none; }
            .tag-danger {color:#cc3235;margin: 0 5px;}
            .pl-tooltip { position: absolute; color: #ffffff; max-width: 600px; font-size: 12px; padding: 5px 10px; background: #333; border-radius: 5px; z-index: 110000; line-height: 1.3; display:none; word-break: break-all;}
             @keyframes load { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
            .pl-loading-box > div > div { position: absolute;border-radius: 50%;}
            .pl-loading-box > div > div:nth-child(1) { top: 9px;left: 9px;width: 82px;height: 82px;background: #ffffff;}
            .pl-loading-box > div > div:nth-child(2) { top: 14px;left: 38px;width: 25px;height: 25px;background: #666666;animation: load 1s linear infinite;transform-origin: 12px 36px;}
            .pl-loading { width: 16px;height: 16px;display: inline-block;overflow: hidden;background: none;}
            .pl-loading-box { width: 100%;height: 100%;position: relative;transform: translateZ(0) scale(0.16);backface-visibility: hidden;transform-origin: 0 0;}
            .pl-loading-box div { box-sizing: content-box; }
            .swal2-container { z-index:100000!important; }
            body.swal2-height-auto { height: inherit!important; }
            `;
            util.addStyle('panlinker-style', 'style', css);
        },

        addPageListener() {
            function _factory(e) {
                let target = $(e.target);
                let item = target.parents('.pl-item');
                let link = item.find('.pl-item-link');
                let progress = item.find('.pl-item-progress');
                let tip = item.find('.pl-item-tip');
                return {
                    item, link, progress, tip, target,
                };
            }

            function _reset(i) {
                ins[i] && clearInterval(ins[i]);
                request[i] && request[i].abort();
                progress[i] = 0;
                idm[i] = false;
            }

            doc.on('mouseenter mouseleave', '.pl-button', (e) => {
                if (e.type === 'mouseenter') {
                    $(e.currentTarget).addClass('button-open');
                    $(e.currentTarget).find('.pl-menu').show();
                } else {
                    $(e.currentTarget).removeClass('button-open');
                }
            });
            doc.on('mouseleave', '.pl-menu', (e) => {
                $(e.currentTarget).hide();
            });
            doc.on('click', '.pl-button-mode', (e) => {
                mode = e.target.dataset.mode;
                Swal.showLoading();
                this.getPCSLink();
            });
            doc.on('click', '.listener-link-api', async (e) => {
                e.preventDefault();
                let o = _factory(e);
                let $width = o.item.find('.pl-progress-inner');
                let $text = o.item.find('.pl-progress-inner-text');
                let filename = o.link[0].dataset.filename;
                let index = o.link[0].dataset.index;
                _reset(index);
                util.get(o.link[0].dataset.link, {"User-Agent": pan.ua}, 'blob', {filename, index});
                ins[index] = setInterval(() => {
                    let prog = +progress[index] || 0;
                    let isIDM = idm[index] || false;
                    if (isIDM) {
                        o.tip.hide();
                        o.progress.hide();
                        o.link.text('已成功唤起IDM，请查看IDM下载框！').animate({opacity: '0.5'}, "slow").show();
                        clearInterval(ins[index]);
                        idm[index] = false;
                    } else {
                        o.link.hide();
                        o.tip.hide();
                        o.progress.show();
                        $width.css('width', prog + '%');
                        $text.text(prog + '%');
                        if (prog === 100) {
                            clearInterval(ins[index]);
                            progress[index] = 0;
                            o.item.find('.pl-progress-stop').hide();
                            o.item.find('.pl-progress-tip').html('下载完成，正在弹出浏览器下载框！');
                        }
                    }
                }, 500);
            });
            doc.on('click', '.listener-retry', async (e) => {
                let o = _factory(e);
                o.tip.hide();
                o.link.show();
            });
            doc.on('click', '.listener-how', async (e) => {
                let o = _factory(e);
                let index = o.link[0].dataset.index;
                if (request[index]) {
                    request[index].abort();
                    clearInterval(ins[index]);
                    o.progress.hide();
                    o.tip.show();
                }

            });
            doc.on('click', '.listener-stop', async (e) => {
                let o = _factory(e);
                let index = o.link[0].dataset.index;
                if (request[index]) {
                    request[index].abort();
                    clearInterval(ins[index]);
                    o.tip.hide();
                    o.progress.hide();
                    o.link.show(0);
                }
            });
            doc.on('click', '.listener-back', async (e) => {
                let o = _factory(e);
                o.tip.hide();
                o.link.show();
            });
            doc.on('click', '.listener-link-aria, .listener-copy-aria', (e) => {
                e.preventDefault();
                if (!e.target.dataset.link) {
                    $(e.target).removeClass('listener-copy-aria').addClass('pl-btn-danger').html(`${pan.init[5]}👉<a href="${pan.assistant}" target="_blank">点击此处安装</a>👈`);
                } else {
                    util.setClipboard(decodeURIComponent(e.target.dataset.link));
                    $(e.target).text('复制成功，快去粘贴吧！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-link-rpc', async (e) => {
                let target = $(e.currentTarget);
                target.find('.icon').remove();
                target.find('.pl-loading').remove();
                target.prepend(this.createLoading());
                let res = await this.sendLinkToRPC(e.currentTarget.dataset.filename, e.currentTarget.dataset.link);
                if (res === 'success') {
                    $('.listener-rpc-task').show();
                    target.removeClass('pl-btn-danger').html('发送成功，快去看看吧！').animate({opacity: '0.5'}, "slow");
                } else if (res === 'assistant') {
                    target.addClass('pl-btn-danger').html(`${pan.init[5]}👉<a href="${pan.assistant}" target="_blank">点击此处安装</a>👈`);
                } else {
                    target.addClass('pl-btn-danger').text('发送失败，请检查您的RPC配置信息！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-send-rpc', (e) => {
                $('.listener-link-rpc').click();
                $(e.target).text('发送完成，发送结果见上方按钮！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-config-rpc', () => {
                this.showSetting();
            });
            doc.on('click', '.listener-rpc-task', () => {
                let rpc = JSON.stringify({
                    domain: util.getValue('setting_rpc_domain'),
                    port: util.getValue('setting_rpc_port'),
                }), url = `http://d.baiduyun.wiki/?rpc=${util.e(rpc)}#${util.getValue('setting_rpc_token')}`;
                GM_openInTab(url, {active: true});
            });
            doc.on('mouseenter mouseleave', '.listener-tip', (e) => {
                if (e.type === 'mouseenter') {
                    let filename = e.currentTarget.innerText;
                    let size = e.currentTarget.dataset.size;
                    let tip = `${filename}<span style="margin-left: 10px;color: #f56c6c;">${size}</span>`;
                    $(e.currentTarget).css({opacity: '0.5'});
                    $('.pl-tooltip').html(tip).css({
                        'left': e.pageX + 10 + 'px',
                        'top': e.pageY - e.currentTarget.offsetTop > 14 ? e.pageY + 'px' : e.pageY + 20 + 'px'
                    }).show();
                } else {
                    $(e.currentTarget).css({opacity: '1'});
                    $('.pl-tooltip').hide(0);
                }
            });
        },

        createTip() {
            $('body').append('<div class="pl-tooltip"></div>');
        },

        createLoading() {
            return $('<div class="pl-loading"><div class="pl-loading-box"><div><div></div><div></div></div></div></div>');
        },

        addButton() {
            if (!pt) return;
            if (($('.pl-button').length || $('.pl-button-init').length) && pan.name !== name) return;

            let $toolWrap;
            let $button = $(`<span class="g-dropdown-button pointer pl-button"><a style="color:#fff;background: ${color};border-color:${color}" class="g-button g-button-blue" href="javascript:;"><span class="g-button-right"><em class="icon icon-download"></em><span class="text" style="width: 60px;">下载助手</span></span></a><span class="menu" style="width:auto;z-index:41;border-color:${color}"><a style="color:${color}" class="g-button-menu pl-button-mode" data-mode="api" href="javascript:;">API下载</a><a style="color:${color}" class="g-button-menu pl-button-mode" data-mode="aria" href="javascript:;" >Aria下载</a><a style="color:${color}" class="g-button-menu pl-button-mode" data-mode="rpc" href="javascript:;">RPC下载</a><a style="color:${color}" class="g-button-menu pl-button-mode" data-mode="curl" href="javascript:;">cURL下载</a>${pan.code == 200 && version < pan.version ? pan.new : ''}</span></span>`);
            if (pt === 'home') $toolWrap = $(pan.btn.home);
            if (pt === 'main') {
                $toolWrap = $(pan.btn.main);
                $button = $(`<div class="pl-button" style="position: relative; display: inline-block; margin-right: 8px;"><button class="u-btn nd-file-list-toolbar-action-item u-btn--primary u-btn--default u-btn--small is-round is-has-icon"  style="background: ${color};border-color: ${color}"><i class="iconfont inline-block-v-middle nd-file-list-toolbar__action-item-icon icon-download"></i><span class="inline-block-v-middle nd-file-list-toolbar-action-item-text">下载助手</span></button><ul class="dropdown-list nd-common-float-menu pl-menu"  style="display: none;"><li class="sub cursor-p pl-button-mode" data-mode="api">API下载</li><li class="sub cursor-p pl-button-mode" data-mode="aria">Aria下载</li><li class="sub cursor-p pl-button-mode" data-mode="rpc">RPC下载</li><li class="sub cursor-p pl-button-mode" data-mode="curl">cURL下载</li>${pan.code == 200 && version < pan.version ? pan.newX : ''}</ul></div>`);
            }
            if (pt === 'share') $toolWrap = $(pan.btn.share);
            $toolWrap.prepend($button);
            util.clog(`助手加载成功！版本：${version}`);
            util.setBDUSS();
            this.addPageListener();
        },

        addInitButton() {
            if (!pt) return;
            if ($('.pl-button-init').length && pan.name !== name) return;

            let $toolWrap;
            util.setInt('.pl-button');
            let $button = $(`<span class="g-dropdown-button pointer pl-button-init" style="opacity:.5"><a style="color:#fff;background: ${color};border-color:${color}" class="g-button g-button-blue" href="javascript:;"><span class="g-button-right"><em class="icon icon-download"></em><span class="text" style="width: 60px;">下载助手</span></span></span></a></span>`);
            if (pt === 'home') $toolWrap = $(pan.btn.home);
            if (pt === 'main') {
                $toolWrap = $(pan.btn.main);
                $button = $(`<a href="javascript:;" class="pl-button-init" style="opacity:.5; display: inline-block; margin-right: 8px;"><button class="u-btn nd-file-list-toolbar-action-item u-btn--primary u-btn--default u-btn--small is-round is-has-icon" style="background: ${color};border-color: ${color}"><i class="iconfont inline-block-v-middle nd-file-list-toolbar__action-item-icon icon-download"></i><span class="inline-block-v-middle nd-file-list-toolbar-action-item-text">下载助手</span></button></a>`);
            }
            if (pt === 'share') $toolWrap = $(pan.btn.share);
            $toolWrap.prepend($button);
            $button.click(() => {
                this._initDialog();
            });
        },

        async getPCSLink() {
            selectList = this.selectedList();
            let fidList = this._getFidList(), url, res;
            if (pt === 'home' || pt === 'main') {
                if (selectList.length === 0) {
                    return util.message.error('提示：请先勾选要下载的文件！');
                }
                if (fidList.length === 2) {
                    return util.message.error('提示：请打开文件夹后勾选文件！');
                }
                fidList = encodeURIComponent(fidList);
                url = `${pan.pcs[0]}&fsids=${fidList}`;
                res = await util.get(url, {"User-Agent": pan.ua});
            }
            if (pt === 'share') {
                this.getShareData();
                if (selectList.length === 0) {
                    return util.message.error('提示：请先勾选要下载的文件！');
                }
                if (fidList.length === 2) {
                    return util.message.error('提示：请打开文件夹后勾选文件！');
                }
                if (!params.sign) {
                    let url = `${pan.pcs[2]}&surl=${params.surl}&logid=${params.logid}`;
                    let r = await util.get(url);
                    if (r.errno === 0) {
                        params.sign = r.data.sign;
                        params.timestamp = r.data.timestamp;
                    } else {
                        let dialog = await Swal.fire({
                            toast: true,
                            icon: 'info',
                            title: `提示：请将文件<span class="tag-danger">[保存到网盘]</span>👉在<span class="tag-danger">[我的网盘]</span>中下载！`,
                            showConfirmButton: true,
                            confirmButtonText: '点击保存',
                            position: 'top',
                        });
                        if (dialog.isConfirmed) {
                            $('.tools-share-save-hb')[0].click();
                        }
                        return;
                    }
                }
                if (!params.bdstoken) {
                    return util.message.error('提示：登录网盘后才能使用此功能哦！');
                }
                let formData = new FormData();
                formData.append('encrypt', params.encrypt);
                formData.append('product', params.product);
                formData.append('uk', params.uk);
                formData.append('primaryid', params.primaryid);
                formData.append('fid_list', fidList);
                formData.append('logid', params.logid);
                params.shareType === 'secret' ? formData.append('extra', params.extra) : '';
                url = `${pan.pcs[1]}&sign=${params.sign}&timestamp=${params.timestamp}`;
                res = await util.post(url, formData, {"User-Agent": pan.ua});
            }
            if (res.errno === 0) {
                let html = this.generateDom(res.list);
                this.showMainDialog(pan[mode][0], html, pan[mode][1]);
            } else if (res.errno === 112) {
                return util.message.error('提示：页面过期，请刷新重试！');
            } else {
                util.message.error('提示：获取下载链接失败！请刷新网页后重试！');
            }
        },

        generateDom(list) {
            let content = '<div class="pl-main">';
            let alinkAllText = '';
            util.sortByName(list);
            list.forEach((v, i) => {
                if (v.isdir === 1) return;
                let filename = v.server_filename || v.filename;
                let ext = util.getExtension(filename);
                let size = util.sizeFormat(v.size);
                let dlink = v.dlink;
                if (mode === 'api') {
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-api" href="${dlink}" data-filename="${filename}" data-link="${dlink}" data-index="${i}">${dlink}</a>
                                <div class="pl-item-tip" style="display: none"><span>若没有弹出IDM下载框，找到IDM <b>选项</b> -> <b>文件类型</b> -> <b>第一个框</b> 中添加后缀 <span class="pl-ext">${ext}</span>，<a href="https://www.baiduyun.wiki/zh-cn/idm.html" target="_blank">详见此处</a></span> <span class="pl-back listener-back">返回</span></div>
                                <div class="pl-item-progress" style="display: none">
                                    <div class="pl-progress">
                                        <div class="pl-progress-outer"></div>
                                        <div class="pl-progress-inner" style="width:5%">
                                          <div class="pl-progress-inner-text">0%</div>
                                        </div>
                                    </div>
                                    <span class="pl-progress-stop listener-stop">取消下载</span>
                                    <span class="pl-progress-tip">未发现IDM，使用自带浏览器下载</span>
                                    <span class="pl-progress-how listener-how">如何唤起IDM？</span>
                                </div></div>`;
                }
                if (mode === 'aria') {
                    let alink = util.convertLinkToAria(dlink, filename, pan.ua);
                    if (typeof (alink) === 'object') {
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link" target="_blank" href="${alink.link}" title="点击复制aria2c链接" data-filename="${filename}" data-link="${alink.link}">${decodeURIComponent(alink.text)}</a> </div>`;
                    } else {
                        alinkAllText += alink + '\r\n';
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${alink}" title="点击复制aria2c链接" data-filename="${filename}" data-link="${alink}">${decodeURIComponent(alink)}</a> </div>`;
                    }
                }
                if (mode === 'rpc') {
                    content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <button class="pl-item-link listener-link-rpc pl-btn-primary pl-btn-info" data-filename="${filename}" data-link="${dlink}"><em class="icon icon-device"></em><span style="margin-left: 5px;">推送到RPC下载器</span></button></div>`;
                }
                if (mode === 'curl') {
                    let alink = util.convertLinkToCurl(dlink, filename, pan.ua);
                    if (typeof (alink) === 'object') {
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link" target="_blank" href="${alink.link}" title="点击复制curl链接" data-filename="${filename}" data-link="${alink.link}">${decodeURIComponent(alink.text)}</a> </div>`;
                    } else {
                        alinkAllText += alink + '\r\n';
                        content += `<div class="pl-item">
                                <div class="pl-item-name listener-tip" data-size="${size}">${filename}</div>
                                <a class="pl-item-link listener-link-aria" href="${alink}" title="点击复制curl链接" data-filename="${filename}" data-link="${alink}">${decodeURIComponent(alink)}</a> </div>`;
                    }
                }
            });
            content += '</div>';
            if (mode === 'aria')
                content += `<div class="pl-extra"><button class="pl-btn-primary listener-copy-aria" data-link="${alinkAllText}">复制全部链接</button></div>`;
            if (mode === 'rpc')
                content += '<div class="pl-extra"><button class="pl-btn-primary  listener-send-rpc">发送全部链接</button><button class="pl-btn-primary listener-config-rpc" style="margin-left: 10px;">配置RPC服务</button><button class="pl-btn-primary pl-btn-success listener-rpc-task" style="margin-left: 10px;display: none">查看下载任务</button></div>';
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
            let rpcData = {
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
                let res = await util.post(url, rpcData, {"User-Agent": pan.ua}, '');
                if (res.result) return 'success';
                return 'fail';
            } catch (e) {
                return 'fail';
            }
        },

        selectedList() {
            try {
                return require('system-core:context/context.js').instanceForSystem.list.getSelected();
            } catch (e) {
                return document.querySelector('.nd-main-layout').__vue__.$children[2].selectedList;
            }
        },

        getLogid() {
            let ut = require("system-core:context/context.js").instanceForSystem.tools.baseService;
            return ut.base64Encode(util.getCookie("BAIDUID"));
        },

        getShareData() {
            let res = locals.dump()
            params.shareType = 'secret';
            params.sign = '';
            params.timestamp = '';
            params.bdstoken = res.bdstoken.value;
            params.channel = 'chunlei';
            params.clienttype = 0;
            params.web = 1;
            params.app_id = 250528;
            params.encrypt = 0;
            params.product = 'share';
            params.logid = this.getLogid();
            params.primaryid = res.shareid.value;
            params.uk = res.share_uk.value;
            params.shareType === 'secret' && (params.extra = this._getExtra());
            params.surl = this._getSurl();
        },

        _detectPage() {
            let path = location.pathname.replace('/disk/', '');
            if (path === 'home') return 'home';
            if (path === 'main') return 'main';
            if (/^\/(s|share)\//.test(path)) return 'share';
            return '';
        },

        _getExtra() {
            let seKey = decodeURIComponent(util.getCookie('BDCLND'));
            return '{' + '"sekey":"' + seKey + '"' + "}";
        },

        _getSurl() {
            let reg = /(?<=s\/|surl=)([a-zA-Z0-9_-]+)/g;
            if (reg.test(location.href)) {
                return location.href.match(reg)[0];
            }
            return '';
        },

        _getFidList() {
            let fidlist = [];
            selectList.forEach(v => {
                if (+v.isdir === 1) return;
                fidlist.push(v.fs_id);
            });
            return '[' + fidlist + ']';
        },
        _resetData() {
            progress = {};
            $.each(request, (key) => {
                (request[key]).abort();
            });
            $.each(ins, (key) => {
                clearInterval(ins[key]);
            });
            idm = {};
            ins = {};
            request = {};
        },

        showMainDialog(title, html, footer) {
            Swal.fire({
                title,
                html,
                footer,
                allowOutsideClick: false,
                showCloseButton: true,
                showConfirmButton: false,
                position: 'top',
                width,
                padding: '15px 20px 5px',
                customClass,
            }).then(() => {
                this._resetData();
            });
        },

        async initPanLinker() {
            pt = this._detectPage();
            let res = await util.post
            (`https://api.baiduyun.wiki/config?ver=${version}&a=${author}`, {author, pt}, {}, 'text');
            pan = JSON.parse(util.d(res));
            Object.freeze && Object.freeze(pan);
            pan.num === util.getValue('setting_init_code') || pan.num === util.getValue('scode') ? this.addButton() : this.addInitButton();
        },

        async _initDialog() {
            let result = await Swal.fire({
                title: pan.init[0],
                html: `<div><img style="width: 250px;margin-bottom: 10px;" src="${pan.img}" alt="${pan.img}"><input class="swal2-input" id="init" type="text" placeholder="${pan.init[1]}"></div>`,
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
                await this._initDialog();
            }
        },

        registerMenuCommand() {
            GM_registerMenuCommand('设置', () => {
                this.showSetting();
            });
        },

        showSetting() {
            let dom = '', btn = '',
                colorList = ['#09AAFF', '#cc3235', '#574ab8', '#518c17', '#ed944b', '#f969a5', '#bca280'];
            dom += `<label class="pl-setting-label"><div class="pl-label">RPC主机</div><input type="text"  placeholder="主机地址，需带上http(s)://" class="pl-input listener-domain" value="${util.getValue('setting_rpc_domain')}"></label>`;
            dom += `<label class="pl-setting-label"><div class="pl-label">RPC端口</div><input type="text" placeholder="端口号，例如：Motrix为16800" class="pl-input listener-port" value="${util.getValue('setting_rpc_port')}"></label>`;
            dom += `<label class="pl-setting-label"><div class="pl-label">RPC密钥</div><input type="text" placeholder="无密钥无需填写" class="pl-input listener-token" value="${util.getValue('setting_rpc_token')}"></label>`;
            dom += `<label class="pl-setting-label"><div class="pl-label">保存路径</div><input type="text" placeholder="文件下载后保存路径，例如：D:" class="pl-input listener-dir" value="${util.getValue('setting_rpc_dir')}"></label>`;

            colorList.forEach((v) => {
                btn += `<div data-color="${v}" style="background: ${v};border: 1px solid ${v}" class="pl-color-box listener-color ${v === util.getValue('setting_theme_color') ? 'checked' : ''}"></div>`;
            });
            dom += `<label class="pl-setting-label"><div class="pl-label">主题颜色</div> <div class="pl-color">${btn}<div></label>`;
            dom = '<div>' + dom + '</div>';

            Swal.fire({
                title: '助手配置',
                html: dom,
                icon: 'info',
                showCloseButton: true,
                showConfirmButton: false,
                footer: pan.footer,
            }).then(() => {
                util.message.success('设置成功！');
                history.go(0);
            });

            doc.on('click', '.listener-color', async (e) => {
                util.setValue('setting_theme_color', e.target.dataset.color);
                util.message.success('设置成功！');
                history.go(0);
            });
            doc.on('input', '.listener-domain', async (e) => {
                util.setValue('setting_rpc_domain', e.target.value);
            });
            doc.on('input', '.listener-port', async (e) => {
                util.setValue('setting_rpc_port', e.target.value);
            });
            doc.on('input', '.listener-token', async (e) => {
                util.setValue('setting_rpc_token', e.target.value);
            });
            doc.on('input', '.listener-dir', async (e) => {
                util.setValue('setting_rpc_dir', e.target.value);
            });
        },

        init() {
            this.initValue();
            this.addStyle();
            this.initPanLinker();
            this.createTip();
            this.registerMenuCommand();
        }
    };

    panlinker.init();
})();
