// ==UserScript==
// @name              网盘直链下载助手
// @namespace         https://github.com/syhyz1990/baiduyun
// @version           5.0.3
// @author            YouXiaoHou
// @icon              https://www.baiduyun.wiki/48x48.png
// @icon64            https://www.baiduyun.wiki/64x64.png
// @description       【网盘直链下载助手】是一款免费开源获取网盘文件真实下载地址的油猴插件，基于开放API，支持Windows，Mac，Linux等多平台，可使用IDM，Xdown等多线程加速工具加速下载，支持RPC协议远程下载。5.0版本支持更换皮肤。
// @license           AGPL
// @homepage          https://www.baiduyun.wiki
// @supportURL        https://github.com/syhyz1990/baiduyun
// @updateURL         https://www.baiduyun.wiki/baiduyun.user.js
// @downloadURL       https://www.baiduyun.wiki/baiduyun.user.js
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

    let pageType = '', selectFile = [], params = {}, mode = '', width = 800, pan = {}, color = '',
      doc = $(document), progress = {}, request = {}, ins = {}, idm = {};
    const scriptInfo = GM_info.script;
    const version = scriptInfo.version;
    const author = scriptInfo.author;
    const customClass = {
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
    };

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
        clog(c) {
            console.group('[网盘直链下载助手]');
            console.log(c);
            console.groupEnd();
        },
        getCookie(name) {
            let arr = document.cookie.replace(/\s/g, "").split(';');
            for (let i = 0, l = arr.length; i < l; i++) {
                let tempArr = arr[i].split('=');
                if (tempArr[0] == name) {
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
        encode(str) {
            return btoa(unescape(encodeURIComponent(str)));
        },
        decode(str) {
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
            let BDUSS = JSON.parse(baiduyunPlugin_BDUSS).BDUSS || '';
            return BDUSS;
        },
        getExtension(name) {
            let reg = /(?!\.)\w+$/;
            if (reg.test(name)) {
                let match = name.match(reg);
                return match[0].toUpperCase();
            }
            return '';
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
        sleep(time) {
            new Promise((resolve) => {
                setTimeout(resolve, time);
            });
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
            return new Promise((resolve, reject) => {
                let requestObj = GM_xmlhttpRequest({
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
        }
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
            .panlinker-item-tip { display: flex; justify-content: space-between;flex: 1}
            .panlinker-back { width: 70px; background: #ddd; border-radius: 3px;cursor:pointer;margin:1px 0 }
            .panlinker-ext { display: inline-block; width: 44px; background: #999; color: #fff; height: 16px; line-height: 16px; font-size: 12px; border-radius: 3px;}
            .panlinker-retry {padding: 3px 10px; background: #cc3235; color: #fff; border-radius: 3px; cursor: pointer;}
            .panlinker-browserdownload {padding: 3px 10px; background: ${color}; color: #fff; border-radius: 3px; cursor: pointer;}
            .panlinker-item-progress { display:flex;flex: 1;align-items:center}
            .panlinker-progress { display: inline-block;vertical-align: middle;width: 100%; box-sizing: border-box;line-height: 1;position: relative;height:15px; flex: 1}
            .panlinker-progress-outer { height: 15px;border-radius: 100px;background-color: #ebeef5;overflow: hidden;position: relative;vertical-align: middle;}
            .panlinker-progress-inner{ position: absolute;left: 0;top: 0;background-color: #409eff;text-align: right;border-radius: 100px;line-height: 1;white-space: nowrap;transition: width .6s ease;}
            .panlinker-progress-inner-text { display: inline-block;vertical-align: middle;color: #d1d1d1;font-size: 12px;margin: 0 5px;height: 15px}
            .panlinker-progress-tip{ flex:1;text-align:right}
            .panlinker-progress-how{ flex: 0 0 90px; background: #ddd; border-radius: 3px; margin-left: 10px; cursor: pointer; text-align: center;}
            .panlinker-progress-stop{ flex: 0 0 50px; padding: 0 10px; background: #cc3235; color: #fff; border-radius: 3px; cursor: pointer;margin-left:10px;height:20px}
            .panlinker-progress-inner-text:after { display: inline-block;content: "";height: 100%;vertical-align: middle;}
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
            .panlinker-color { flex: 1;display: flex;flex-wrap: wrap; margin-right: -10px;}
            .panlinker-color-box { width: 35px;height: 35px;margin:10px 10px 0 0;; box-sizing: border-box;border:1px solid #fff;cursor:pointer }
            .panlinker-color-box.checked { border:3px dashed #111!important }
            .panlinker-close:focus { outline: 0; box-shadow: none; }
            .tag-danger {color:#cc3235;margin: 0 5px;}
            `);

        },

        addPageListener() {
            function _factory(e) {
                let target = $(e.target);
                let item = target.parents('.panlinker-item');
                let link = item.find('.panlinker-item-link');
                let progress = item.find('.panlinker-item-progress');
                let tip = item.find('.panlinker-item-tip');
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

            doc.on('click', '#panlinker-button', () => {
                $('#panlinker-button').addClass('button-open');
            });
            doc.on('mouseleave', '#panlinker-button', () => {
                $('#panlinker-button').removeClass('button-open');
            });
            doc.on('click', '.panlinker-button-mode', (e) => {
                mode = e.target.dataset.mode;
                Swal.showLoading();
                this.getPCSLink();
            });
            doc.on('click', '.listener-link-api', async (e) => {
                e.preventDefault();
                let o = _factory(e);
                let $width = o.item.find('.panlinker-progress-inner');
                let $text = o.item.find('.panlinker-progress-inner-text');
                let filename = o.link[0].dataset.filename;
                let index = o.link[0].dataset.index;
                _reset(index);
                util.get(o.link[0].dataset.link, {"User-Agent": pan.ua}, 'blob', {filename, index});
                ins[index] = setInterval(() => {
                    let prog = progress[index] || 0;
                    let isIDM = idm[index] || false;
                    if (isIDM) { //检测到IDM
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
                        if (prog == 100) {
                            clearInterval(ins[index]);
                            progress[index] = 0;
                            o.item.find('.panlinker-progress-stop').hide();
                            o.item.find('.panlinker-progress-tip').html('下载完成，正在弹出浏览器下载框！');
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
                    $(e.target).removeClass('listener-copy-aria').addClass('panlinker-btn-danger').html(`${pan.init[5]}👉<a href="${pan.assistant}" target="_blank">点击此处安装</a>👈`);
                } else {
                    util.setClipboard(decodeURIComponent(e.target.dataset.link));
                    $(e.target).text('复制成功，快去粘贴吧！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-link-rpc', async (e) => {
                let res = await this.sendLinkToRPC(e.target.dataset.filename, e.target.dataset.link);
                let target = $(e.target).parents('.panlinker-item').find('.listener-link-rpc');
                if (res === 'success') {
                    target.removeClass('panlinker-btn-danger').text('发送成功，快去看看吧！').animate({opacity: '0.5'}, "slow");
                } else if (res === 'assistant') {
                    target.addClass('panlinker-btn-danger').html(`${pan.init[5]}👉<a href="${pan.assistant}" target="_blank">点击此处安装</a>👈`);
                } else {
                    target.addClass('panlinker-btn-danger').text('发送失败，请检查您的RPC配置信息！').animate({opacity: '0.5'}, "slow");
                }
            });
            doc.on('click', '.listener-send-rpc', (e) => {
                $('.listener-link-rpc').click();
                $(e.target).text('发送完成，发送结果见上方按钮！').animate({opacity: '0.5'}, "slow");
            });
            doc.on('click', '.listener-config-rpc', (e) => {
                this.showSetting();
            });
        },

        /**
         * 添加按钮
         */
        addButton() {
            if ($('#panlinker-button').length > 0) return;
            pageType = this._detectPage();
            if (pageType !== 'home' && pageType !== 'share') return;
            let $toolWrap;
            pageType === 'home' ? $toolWrap = $(pan.btn.home) : $toolWrap = $(pan.btn.share);
            let $button = $(`<span class="g-dropdown-button pointer" id="panlinker-button"><a style="color:#fff;background: ${color};border-color:${color}" class="g-button g-button-blue" href="javascript:;"><span class="g-button-right"><em class="icon icon-download"></em><span class="text" style="width: 60px;">下载助手</span></span></a><span class="menu" style="width:auto;z-index:41;border-color:${color}"><a style="color:${color}" class="g-button-menu panlinker-button-mode" data-mode="api" href="javascript:;">API下载</a><a style="color:${color}" class="g-button-menu panlinker-button-mode" data-mode="aria" href="javascript:;" >Aria下载</a><a style="color:${color}" class="g-button-menu panlinker-button-mode" data-mode="rpc" href="javascript:;">RPC下载</a>${pan.code === 200 && version < pan.version ? pan.new : ''}</span></span>`);
            $toolWrap.prepend($button);

            util.setBDUSS();
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
                this.initParams();
                if (selectFile.length === 0) {
                    return util.message.error('提示：请先勾选要下载的文件！');
                }
                if (!params.sign) {
                    let res = await Swal.fire({
                        toast: true,
                        icon: 'info',
                        title: `提示：请将文件<span class="tag-danger">[保存到网盘]</span>👉在<span class="tag-danger">[我的网盘]</span>中下载！`,
                        showConfirmButton: true,
                        confirmButtonText: '点击保存',
                        position: 'top',
                    });
                    if (res.isConfirmed) {
                        $('.tools-share-save-hb')[0].click();
                    }
                    return;
                }
                if (!params.bdstoken) {
                    return util.message.error('提示：登录网盘后才能使用此功能哦！');
                }
                let formData = new FormData();
                formData.append('encrypt', params.encrypt);
                formData.append('product', params.product);
                formData.append('uk', params.uk);
                formData.append('primaryid', params.primaryid);
                formData.append('fid_list', fid_list);
                formData.append('logid', params.logid);
                params.shareType == 'secret' ? formData.append('extra', params.extra) : '';
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

        /**
         * 生成Dom元素
         * @param list
         * @returns {string}
         */
        generateDom(list) {
            let content = '<div class="panlinker-main">';
            let alinkAllText = '';
            list.forEach((v, i) => {
                if (v.isdir === 1) return;
                let filename = v.server_filename || v.filename;
                let ext = util.getExtension(filename);
                let dlink = v.dlink;
                if (mode === 'api') {
                    content += `<div class="panlinker-item">
                                <div class="panlinker-item-title" title="${filename}">${filename}</div>
                                <a class="panlinker-item-link listener-link-api" href="${dlink}" data-filename="${filename}" data-link="${dlink}" data-index="${i}" >${dlink}</a>
                                <div class="panlinker-item-tip" style="display: none"><span>若没有弹出IDM下载框，找到IDM <b>选项</b> -> <b>文件类型</b> -> <b>第一个框</b> 中添加后缀 <span class="panlinker-ext">${ext}</span>，<a href="https://www.baiduyun.wiki/zh-cn/idm.html" target="_blank">详见此处</a></span> <span class="panlinker-back listener-back">返回</span></div>
                                <div class="panlinker-item-progress" style="display: none">
                                    <div class="panlinker-progress">
                                        <div class="panlinker-progress-outer"></div>
                                        <div class="panlinker-progress-inner" style="width:5%">
                                          <div class="panlinker-progress-inner-text">0%</div>
                                        </div>
                                    </div>
                                    <span class="panlinker-progress-stop listener-stop">取消下载</span>
                                    <span class="panlinker-progress-tip">未发现IDM，使用自带浏览器下载</span>
                                    <span class="panlinker-progress-how listener-how">如何唤起IDM？</span>
                                </div></div>`;
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
                                <a class="panlinker-item-link listener-link-aria" href="${alink}" alt="点击复制aria2c链接" data-filename="${filename}" data-link="${alink}">${decodeURIComponent(alink)}</a> </div>`;
                    }
                }
                if (mode === 'rpc') {
                    content += `<div class="panlinker-item">
                                <div class="panlinker-item-title" title="${filename}">${filename}</div>
                                <button class="panlinker-item-link listener-link-rpc panlinker-btn-primary panlinker-btn-info" data-filename="${filename}" data-link="${dlink}"><em class="icon icon-device"></em><span style="margin-left: 5px;">推送到RPC下载器</span></button></div>`;
                }
            });
            content += '</div>';
            if (mode === 'aria')
                content += `<div class="panlinker-extra"><button class="panlinker-btn-primary listener-copy-aria" data-link="${alinkAllText}">复制全部链接</button></div>`;
            if (mode === 'rpc')
                content += '<div class="panlinker-extra"><button class="panlinker-btn-primary  listener-send-rpc">发送全部链接</button><button class="panlinker-btn-primary listener-config-rpc" style="margin-left: 10px;">配置RPC服务</button></div>';
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

        getLogid() {
            let ut = require("system-core:context/context.js").instanceForSystem.tools.baseService;
            return ut.base64Encode(util.getCookie("BAIDUID"));
        },

        initParams() {
            params.shareType = 'secret';
            params.sign = this._getLocals('sign');
            params.timestamp = this._getLocals('timestamp');
            params.bdstoken = this._getLocals('bdstoken');
            params.channel = 'chunlei';
            params.clienttype = 0;
            params.web = 1;
            params.app_id = 250528;
            params.encrypt = 0;
            params.product = 'share';
            params.logid = this.getLogid();
            params.primaryid = this._getLocals('shareid');
            params.uk = this._getLocals('share_uk');
            params.shareType === 'secret' && (params.extra = this._getExtra());
        },

        _detectPage() {
            let regx = /[\/].+[\/]/g;
            let page = location.pathname.match(regx);
            let path = page[0].replace(/\//g, '');
            if (path === 'disk') return 'home';
            if (path === 's' || path === 'share') return 'share';
            return '';
        },

        _getLocals(val) {
            try {
                return locals.get(val);
            } catch {
                return '';
            }
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

        async getPanLinker() {
            let start = performance.now();
            let res = await util.post
            (`https://api.baiduyun.wiki/upgrade?ver=${version}&a=${author}`, {}, {}, 'text');
            pan = JSON.parse(util.decode(res));
            await this._initDialog();
            let end = performance.now();
            let time = (end - start).toFixed(2);
            util.clog(`助手加载成功！版本：${version} 耗时：${time}毫秒`);
            Object.freeze && Object.freeze(pan);
        },

        async _initDialog() {
            if (pan.num === util.getValue('setting_init_code') || pan.num === util.getValue('scode')) {
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

            GM_registerMenuCommand(`检查更新：v${version}`, () => {
                GM_openInTab('https://www.baiduyun.wiki/install.html', {active: true});
            });
        },

        showSetting() {
            let dom = '', btn = '',
              colorList = ['#09AAFF', '#cc3235', '#574ab8', '#518c17', '#ed944b', '#f969a5', '#bca280'];
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">RPC主机</div><input type="text"  placeholder="主机地址，需带上http(s)://" class="panlinker-input listener-domain" value="${util.getValue('setting_rpc_domain')}"></label>`;
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">RPC端口</div><input type="text" placeholder="端口号，例如：Motrix为16800" class="panlinker-input listener-port" value="${util.getValue('setting_rpc_port')}"></label>`;
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">RPC密钥</div><input type="text" placeholder="无密钥无需填写" class="panlinker-input listener-token" value="${util.getValue('setting_rpc_token')}"></label>`;
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">保存路径</div><input type="text" placeholder="文件下载后保存路径，例如：D:" class="panlinker-input listener-dir" value="${util.getValue('setting_rpc_dir')}"></label>`;

            colorList.forEach((v) => {
                btn += `<div data-color="${v}" style="background: ${v};border: 1px solid ${v}" class="panlinker-color-box listener-color ${v == util.getValue('setting_theme_color') ? 'checked' : ''}"></div>`;
            });
            dom += `<label class="panlinker-setting-label"><div class="panlinker-label">主题颜色</div> <div class="panlinker-color">${btn}<div></label>`;
            dom = '<div>' + dom + '</div>';

            Swal.fire({
                title: '助手配置',
                html: dom,
                icon: 'info',
                showCloseButton: true,
                showConfirmButton: false,
                footer: pan.footer,
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
            this.getPanLinker();
            this.registerMenuCommand();
        }
    };

    main.init();
})();
