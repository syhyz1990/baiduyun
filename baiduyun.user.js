// ==UserScript==
// @name              网盘直链下载助手
// @namespace         https://github.com/syhyz1990/baiduyun
// @version           4.3.0
// @icon              https://www.baiduyun.wiki/48x48.png
// @description       【网盘直链下载助手】是一款免费开源获取网盘文件真实下载地址的油猴插件，基于PCSAPI，支持Windows，Mac，Linux，Android等多平台，可使用IDM，Xdown等多线程加速工具加速下载，支持RPC协议远程下载。
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
// @require           https://cdn.jsdelivr.net/npm/sweetalert2@9
// @connect           baidu.com
// @connect           baidupcs.com
// @connect           baiduyun.wiki
// @connect           localhost
// @connect           *
// @run-at            document-idle
// @grant             unsafeWindow
// @grant             GM_addStyle
// @grant             GM_xmlhttpRequest
// @grant             GM_download
// @grant             GM_setClipboard
// @grant             GM_setValue
// @grant             GM_getValue
// @grant             GM_openInTab
// @grant             GM_info
// @grant             GM_registerMenuCommand
// @grant             GM_cookie
// ==/UserScript==

;(() => {
    'use strict';
    const version = GM_info.script.version;
    const classMap = {
        'bar-search': 'OFaPaO',
        'list-tools': 'tcuLAu',
        'header': 'vyQHNyb'
    };
    const errorMsg = {
        'dir': '提示：不支持整个文件夹下载，可进入文件夹内获取文件链接下载！',
        'unlogin': '提示：登录网盘后才能使用此功能哦！',
        'fail': '提示：获取下载链接失败！请刷新网页后重试！',
        'unselected': '提示：请先选择要下载的文件！',
        'morethan': '提示：多个文件请点击【显示链接】！',
        'toobig': '提示：只支持300M以下的文件夹，若链接无法下载，请进入文件夹后勾选文件获取！',
        'timeout': '提示：页面过期，请刷新重试！',
        'wrongcode': '提示：获取验证码失败！',
        'deleted': '提示：文件不存在或已被百度和谐，无法下载！',
    };
    let defaultCode = 250528;
    let secretCode = getValue('secretCodeV') ? getValue('secretCodeV') : defaultCode;
    let ids = [];
    let panhelper = {};
    let userAgent = '';
    let number = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
    let Toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: false,
        onOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
    let ariaRPC = {
        domain: getValue('rpcDomain') || 'http://localhost',
        port: getValue('rpcPort') || 6800,
        token: getValue('rpcToken') || '',
        dir: getValue('rpcDir') || 'D:/',
    };

    function clog(c1, c2, c3) {
        c1 = c1 ? c1 : '';
        c2 = c2 ? c2 : '';
        c3 = c3 ? c3 : '';
        console.group('[网盘直链下载助手]');
        console.log(c1, c2, c3);
        console.groupEnd();
    }

    function updateBDUSS_GM() {
        return new Promise((resolve) => {
            if (GM_cookie) {
                GM_cookie('list', { name: 'BDUSS' }, function (cookies, error) {
                    if (!error) {
                        setStorage("baiduyunPlugin_BDUSS", JSON.stringify({ BDUSS: cookies[0].value }))
                        console.log("BDUSS 已更新", cookies[0].value);
                        resolve(cookies[0].value);
                    }
                });
            }
        });
    }

    function getBDUSS() {
        let baiduyunPlugin_BDUSS = getStorage('baiduyunPlugin_BDUSS') ? getStorage('baiduyunPlugin_BDUSS') : '{"baiduyunPlugin_BDUSS":""}';
        let BDUSS = JSON.parse(baiduyunPlugin_BDUSS).BDUSS;
        if (!BDUSS) {
            Swal.fire({
                icon: 'error',
                title: '提示',
                html: panhelper.t.e,
                footer: '【网盘万能助手】是增强扩展插件，安装后请刷新',
                confirmButtonText: '安装'
            }).then((result) => {
                if (result.value) {
                    GM_openInTab(panhelper.w, {active: true});
                }
            });
        }
        return BDUSS;
    }

    function aria2c(link, filename, ua) {
        let BDUSS = getBDUSS();
        ua = ua || userAgent;
        if (BDUSS) {
            return encodeURIComponent(`aria2c "${link}" --out "${filename}" --header "User-Agent: ${ua}" --header "Cookie: BDUSS=${BDUSS}"`);
        } else {
            return '请先安装网盘万能助手，安装后请重启浏览器！！！';
        }
    }

    function replaceLink(link) {
        return link ? link.replace(/&/g, '&amp;') : '';
    }

    function detectPage() {
        let regx = /[\/].+[\/]/g;
        let page = location.pathname.match(regx);
        return page[0].replace(/\//g, '');
    }

    function getCookie(e) {
        let o, t;
        let n = document, c = decodeURI;
        return n.cookie.length > 0 && (o = n.cookie.indexOf(e + "="), -1 != o) ? (o = o + e.length + 1, t = n.cookie.indexOf(";", o), -1 == t && (t = n.cookie.length), c(n.cookie.substring(o, t))) : "";
    }

    function setCookie(key, value, t) {
        let oDate = new Date();  //创建日期对象
        oDate.setTime(oDate.getTime() + t * 60 * 1000); //设置过期时间
        document.cookie = key + '=' + value + ';expires=' + oDate.toGMTString();  //设置cookie的名称，数值，过期时间
    }

    function getValue(name) {
        return GM_getValue(name);
    }

    function setValue(name, value) {
        GM_setValue(name, value);
    }

    function getStorage(key) {
        return localStorage.getItem(key);
    }

    function setStorage(key, value) {
        return localStorage.setItem(key, value);
    }

    function encode(str) {
        return btoa(unescape(encodeURIComponent(btoa(unescape(encodeURIComponent(str))))));
    }

    function decode(str) {
        return decodeURIComponent(escape(atob(decodeURIComponent(escape(atob(str))))));
    }

    function getLogID() {
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

        return w(getCookie(name));
    }

    function rpcSetting() {
        let dom = '';
        dom += '<div class="flex-center-between"><label for="rpcDomain" class="label">主机</label><input type="text" id="rpcDomain" value="' + ariaRPC.domain + '" class="swal2-input" placeholder="http://localhost"></div>';
        dom += '<div class="flex-center-between"><label for="rpcPort" class="label">端口</label><input type="text" id="rpcPort" value="' + ariaRPC.port + '" class="swal2-input" placeholder="6800"></div>';
        dom += '<div class="flex-center-between"><label for="rpcToken" class="label">密钥</label><input type="text" id="rpcToken" value="' + ariaRPC.token + '" class="swal2-input" placeholder="没有留空"></div>';
        dom += '<div class="flex-center-between"><label for="rpcDir" class="label">下载路径</label><input type="text" id="rpcDir" value="' + ariaRPC.dir + '" class="swal2-input" placeholder="默认为D:\"></div>';
        dom += '<div class="flex-center-between" style="margin-top: 15px;font-size: 0.85em;color: #999;"><div class="label">快速配置</div> <div style="flex: 1;text-align: left;"><span class="rtag" id="rpc1">Motrix</span><span class="rtag" id="rpc2">Aria2 Tools</span><span class="rtag" id="rpc3">AriaNgGUI</span></div></div>';
        dom = '<div>' + dom + '</div>';
        let $dom = $(dom);

        $(document).on('click', '#rpc1', () => {
            $('#rpcDomain').val('http://localhost');
            $('#rpcPort').val(16800);
            $('#rpcDir').val('D:');
        });
        $(document).on('click', '#rpc2', () => {
            $('#rpcDomain').val('http://localhost');
            $('#rpcPort').val(6800);
            $('#rpcDir').val('D:');
        });
        $(document).on('click', '#rpc3', () => {
            $('#rpcDomain').val('http://192.168.0.?');
            $('#rpcPort').val(6800);
            $('#rpcDir').val('D:');
        });

        Swal.fire({
              title: 'RPC配置',
              allowOutsideClick: false,
              html: $dom[0],
              showCancelButton: true,
              confirmButtonText: '保存',
              cancelButtonText: '取消',
              footer: panhelper.t.n
          }
        ).then((result) => {
            if (result.value) {
                ariaRPC.domain = $('#rpcDomain').val();
                ariaRPC.port = $('#rpcPort').val();
                ariaRPC.token = $('#rpcToken').val();
                ariaRPC.dir = $('#rpcDir').val();
                setValue('rpcDomain', ariaRPC.domain);
                setValue('rpcPort', ariaRPC.port);
                setValue('rpcToken', ariaRPC.token);
                setValue('rpcDir', ariaRPC.dir);
                Toast.fire({
                    text: '设置成功',
                    icon: 'success'
                });
            }
        });
    }

    function Dialog() {
        let linkList = [];
        let showParams;
        let dialog, shadow;

        function createDialog() {
            let screenWidth = document.body.clientWidth;
            let dialogLeft = screenWidth > 800 ? (screenWidth - 800) / 2 : 0;
            let $dialog_div = $('<div class="dialog" style="width: 800px; top: 0px; bottom: auto; left: ' + dialogLeft + 'px; right: auto; display: hidden; visibility: visible; z-index: 52;"></div>');
            let $dialog_header = $('<div class="dialog-header"><h3><span class="dialog-title" style="display:inline-block;width:740px;white-space:nowrap;overflow-x:hidden;text-overflow:ellipsis"></span></h3></div>');
            let $dialog_control = $('<div class="dialog-control"><span class="dialog-icon dialog-close">×</span></div>');
            let $dialog_body = $('<div class="dialog-body"></div>');
            let $dialog_tip = $('<div class="dialog-tip"><p></p></div>');

            $dialog_div.append($dialog_header.append($dialog_control)).append($dialog_body);

            let $dialog_button = $('<div class="dialog-button" style="display:none"></div>');
            let $dialog_button_div = $('<div style="display:table;margin:auto"></div>');
            let $dialog_copy_button = $('<button id="dialog-copy-button" style="display:none">复制全部链接</button>');
            let $dialog_send_button = $('<button id="dialog-send-button" class="send-all" style="display:none">发送全部链接</button>');
            let $dialog_rpc_button = $('<button id="dialog-rpc-button" class="rpc-setting" style="display:none">配置RPC服务</button>');

            $dialog_button_div.append($dialog_copy_button).append($dialog_send_button).append($dialog_rpc_button);
            $dialog_button.append($dialog_button_div);
            $dialog_div.append($dialog_button);

            $dialog_copy_button.click(() => {
                let content = '';
                if (showParams.type === 'batch') {
                    $.each(linkList, (index, element) => {
                        if (index === linkList.length - 1)
                            content += element.downloadlink[0];
                        else
                            content += element.downloadlink[0] + '\r\n';
                    });
                }
                if (showParams.type === 'batchAria') {
                    $.each(linkList, (index, element) => {
                        if (index === linkList.length - 1)
                            content += decodeURIComponent(aria2c(element.dlink, element.filename, userAgent));
                        else
                            content += decodeURIComponent(aria2c(element.dlink, element.filename, userAgent) + '\r\n');
                    });
                }
                if (showParams.type === 'rpc') {
                    $.each(linkList, (index, element) => {
                        if (index === linkList.length - 1)
                            content += element.downloadlink;
                        else
                            content += element.downloadlink + '\r\n';
                    });
                }
                if (showParams.type === 'shareLink') {
                    $.each(linkList, (index, element) => {
                        if (element.dlink == 'error')
                            return;
                        if (index == linkList.length - 1)
                            content += element.dlink;
                        else
                            content += element.dlink + '\r\n';
                    });
                }
                if (showParams.type == 'shareAriaLink') {
                    $.each(linkList, (index, element) => {
                        if (element.dlink == 'error')
                            return;
                        if (index == linkList.length - 1)
                            content += decodeURIComponent(aria2c(element.dlink, element.server_filename));
                        else
                            content += decodeURIComponent(aria2c(element.dlink, element.server_filename) + '\r\n');
                    });
                }
                GM_setClipboard(content, 'text');
                if (content != '') {
                    Toast.fire({
                        icon: 'success',
                        text: '已将链接复制到剪贴板！'
                    });

                } else {
                    Toast.fire({
                        icon: 'error',
                        text: '复制失败，请手动复制！'
                    });
                }
            });

            $dialog_div.append($dialog_tip);
            $('body').append($dialog_div);
            $dialog_control.click(dialogControl);
            return $dialog_div;
        }

        function createShadow() {
            let $shadow = $('<div class="dialog-shadow" style="position: fixed; left: 0px; top: 0px; z-index: 50; background: rgb(0, 0, 0) none repeat scroll 0% 0%; opacity: 0.5; width: 100%; height: 100%; display: none;"></div>');
            $('body').append($shadow);
            return $shadow;
        }

        this.open = (params) => {
            showParams = params;
            linkList = [];
            if (params.type == 'link') {
                linkList = params.list.urls;
                $('div.dialog-header h3 span.dialog-title', dialog).html(params.title + "：" + params.list.filename);
                $.each(params.list.urls, (index, element) => {
                    element.url = replaceLink(element.url);
                    let $div = $('<div><div style="width:30px;float:left">' + element.rank + ':</div><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><a href="' + element.url + '">' + element.url + '</a></div></div>');

                    $('div.dialog-body', dialog).append($div);
                });
            }

            if (params.type === 'batch' || params.type === 'batchAria' || params.type === 'batchAriaRPC' || params.type === 'pcs') {
                linkList = params.list;
                $('div.dialog-header h3 span.dialog-title', dialog).html(params.title);
                $.each(params.list, (index, element) => {
                    let $div = $('<div class="row"><div class="ui-title" title="' + element.filename + '">' + element.filename + '</div><span>：</span></div>');
                    if (params.type === 'batch') {
                        $.each(element.downloadlink, (i, e) => {
                            if (i === 0) {
                                $div.append($('<a class="ui-link api-link" href="' + e + '" data-link=' + e + '>默认链接</a>'));
                            } else {
                                if (getValue('SETTING_B'))
                                    $div.append($('<a class="ui-link api-link" href="' + e + '"  data-link=' + e + '>备用链接' + number[i] + '</a>'));
                            }
                        });
                    }
                    if (params.type === 'pcs') {
                        $div.append($('<a class="ui-link pcs-link" data-filename=' + element.filename + ' data-link=' + element.dlink + ' href="javascript:;">' + element.dlink + '</a>'));
                    }
                    if (params.type === 'batchAria') {
                        let link = decodeURIComponent(aria2c(element.dlink, element.filename, userAgent));
                        $div.append($('<a class="ui-link aria-link" href="javascript:;">' + link + '</a>'));
                    }
                    if (params.type === 'batchAriaRPC') {
                        $div.append($('<button class="aria-rpc" data-link="' + element.dlink + '" data-filename="' + element.filename + '">点击发送到Aria下载器</button>'));
                    }
                    $('div.dialog-body', dialog).append($div);
                });
            }
            if (params.type === 'shareLink') {
                linkList = params.list;
                $('div.dialog-header h3 span.dialog-title', dialog).html(params.title);
                $.each(params.list, (index, element) => {
                    element.dlink = replaceLink(element.dlink);
                    if (element.isdir == 1) return;
                    let $div = $('<div class="row"><div class="ui-title" title="' + element.server_filename + '">' + element.server_filename + '</div><span>：</span><a href="' + element.dlink + '" class="share-download">' + element.dlink + '</a></div>');
                    $('div.dialog-body', dialog).append($div);
                });
            }
            if (params.type === 'rpcLink') {
                linkList = params.list;
                $('div.dialog-header h3 span.dialog-title', dialog).html(params.title);
                $.each(params.list, (index, element) => {
                    element.dlink = replaceLink(element.dlink);
                    if (element.isdir == 1) return;
                    let $div = $('<div class="row"><div class="ui-title" title="' + element.server_filename + '">' + element.server_filename + '</div><span>：</span><button class="aria-rpc" data-link="' + element.dlink + '" data-filename="' + element.server_filename + '">点击发送到Aria下载器</button></div>');
                    $('div.dialog-body', dialog).append($div);
                });
            }
            if (params.type === 'shareAriaLink') {
                linkList = params.list;
                $('div.dialog-header h3 span.dialog-title', dialog).html(params.title);
                $.each(params.list, (index, element) => {
                    if (element.isdir == 1) return;
                    let link = decodeURIComponent(aria2c(element.dlink, element.server_filename));
                    let $div = $('<div class="row"><div class="ui-title" title="' + element.server_filename + '">' + element.server_filename + '</div><span>：</span><a href="javasctipt:void(0)" class="aria-link">' + link + '</a></div>');
                    $('div.dialog-body', dialog).append($div);
                });
            }

            if (params.tip) {
                $('div.dialog-tip p', dialog).html(params.tip);
            }

            if (params.showcopy) {
                $('div.dialog-button', dialog).show();
                $('div.dialog-button #dialog-copy-button', dialog).show();
            }

            if (params.showrpc) {
                $('div.dialog-button', dialog).show();
                $('div.dialog-button #dialog-send-button', dialog).show();
                $('div.dialog-button #dialog-rpc-button', dialog).show();
            }

            shadow.show();
            dialog.show();
        };

        this.close = () => {
            dialogControl();
        };

        function dialogControl() {
            $('div.dialog-body', dialog).children().remove();
            $('div.dialog-header h3 span.dialog-title', dialog).text('');
            $('div.dialog-tip p', dialog).text('');
            $('div.dialog-button', dialog).hide();
            $('div.dialog-button button#dialog-copy-button', dialog).hide();
            $('div.dialog-button button#dialog-send-button', dialog).hide();
            $('div.dialog-button button#dialog-rpc-button', dialog).hide();
            dialog.hide();
            shadow.hide();
        }

        dialog = createDialog();
        shadow = createShadow();
    }

    function VCodeDialog(refreshVCode, confirmClick) {
        let dialog, shadow;

        function createDialog() {
            let screenWidth = document.body.clientWidth;
            let dialogLeft = screenWidth > 520 ? (screenWidth - 520) / 2 : 0;
            let $dialog_div = $('<div class="dialog" id="dialog-vcode" style="width:520px;top:0px;bottom:auto;left:' + dialogLeft + 'px;right:auto;display:none;visibility:visible;z-index:52"></div>');
            let $dialog_header = $('<div class="dialog-header"><h3><span class="dialog-header-title"><em class="select-text">提示</em></span></h3></div>');
            let $dialog_control = $('<div class="dialog-control"><span class="dialog-icon dialog-close icon icon-close"><span class="sicon">x</span></span></div>');
            let $dialog_body = $('<div class="dialog-body"></div>');
            let $dialog_body_div = $('<div style="text-align:center;padding:22px"></div>');
            let $dialog_body_download_verify = $('<div class="download-verify" style="margin-top:10px;padding:0 28px;text-align:left;font-size:12px;"></div>');
            let $dialog_verify_body = $('<div class="verify-body">请输入验证码：</div>');
            let $dialog_input = $('<input id="dialog-input" type="text" style="padding:3px;width:85px;height:23px;border:1px solid #c6c6c6;background-color:white;vertical-align:middle;" class="input-code" maxlength="4">');
            let $dialog_img = $('<img id="dialog-img" class="img-code" style="margin-left:10px;vertical-align:middle;" alt="点击换一张" src="" width="100" height="30">');
            let $dialog_refresh = $('<a href="javascript:;" style="text-decoration:underline;" class="underline">换一张</a>');
            let $dialog_err = $('<div id="dialog-err" style="padding-left:84px;height:18px;color:#d80000" class="verify-error"></div>');
            let $dialog_footer = $('<div class="dialog-footer g-clearfix"></div>');
            let $dialog_confirm_button = $('<a class="g-button g-button-blue" data-button-id="" data-button-index href="javascript:;" style="padding-left:36px"><span class="g-button-right" style="padding-right:36px;"><span class="text" style="width:auto;">确定</span></span></a>');
            let $dialog_cancel_button = $('<a class="g-button" data-button-id="" data-button-index href="javascript:;" style="padding-left: 36px;"><span class="g-button-right" style="padding-right: 36px;"><span class="text" style="width: auto;">取消</span></span></a>');

            $dialog_header.append($dialog_control);
            $dialog_verify_body.append($dialog_input).append($dialog_img).append($dialog_refresh);
            $dialog_body_download_verify.append($dialog_verify_body).append($dialog_err);
            $dialog_body_div.append($dialog_body_download_verify);
            $dialog_body.append($dialog_body_div);
            $dialog_footer.append($dialog_confirm_button).append($dialog_cancel_button);
            $dialog_div.append($dialog_header).append($dialog_body).append($dialog_footer);
            $('body').append($dialog_div);

            $dialog_control.click(dialogControl);
            $dialog_img.click(refreshVCode);
            $dialog_refresh.click(refreshVCode);
            $dialog_input.keypress((event) => {
                if (event.which == 13)
                    confirmClick();
            });
            $dialog_confirm_button.click(confirmClick);
            $dialog_cancel_button.click(dialogControl);
            $dialog_input.click(() => {
                $('#dialog-err').text('');
            });
            return $dialog_div;
        }

        this.open = (vcode) => {
            if (vcode)
                $('#dialog-img').attr('src', vcode.img);
            dialog.show();
            shadow.show();
        };
        this.close = () => {
            dialogControl();
        };
        dialog = createDialog();
        shadow = $('div.dialog-shadow');

        function dialogControl() {
            $('#dialog-img', dialog).attr('src', '');
            $('#dialog-err').text('');
            dialog.hide();
            shadow.hide();
        }
    }

    function PanHelper() {
        let yunData, sign, timestamp, bdstoken, logid, fid_list;
        let fileList = [], selectFileList = [], batchLinkList = [], batchLinkListAll = [], linkList = [];
        let dialog, searchKey;
        let panAPIUrl = location.protocol + "//" + location.host + "/api/";
        let restAPIUrl = location.protocol + "//pcs.baidu.com/rest/2.0/pcs/";
        let clientAPIUrl = location.protocol + "//pan.baidu.com/rest/2.0/";

        this.init = () => {
            yunData = unsafeWindow.yunData;
            initVar();
            registerEventListener();
            addButton();
            createIframe();
            updateBDUSS_GM();
            dialog = new Dialog({addCopy: true});
            clog('下载助手加载成功！当前版本：', version);
        };

        function getSelectedFile() {
            return require("disk-system:widget/pageModule/list/listInit.js").getCheckedItems();
        }

        function initVar() {
            timestamp = yunData.timestamp || '';
            bdstoken = yunData.MYBDSTOKEN || '';
            logid = getLogID();
        }

        function registerEventListener() {
            $(document).on('click', '.api-link', (e) => {
                e.preventDefault();
                if (e.target.dataset.link) {
                    execDownload(e.target.dataset.link);
                }
            });
            $(document).on('click', '.aria-rpc', (e) => {
                $(e.target).addClass('clicked');
                let link = e.target.dataset.link;
                let filename = e.target.dataset.filename;

                let url = ariaRPC.domain + ":" + ariaRPC.port + '/jsonrpc';
                let json_rpc = {
                    id: new Date().getTime(),
                    jsonrpc: '2.0',
                    method: 'aria2.addUri',
                    params: [
                        "token:" + ariaRPC.token,
                        [link],
                        {
                            dir: ariaRPC.dir,
                            out: filename,
                            header: ['User-Agent:' + userAgent, 'Cookie: BDUSS=' + getBDUSS()]
                        }
                    ]
                };

                GM_xmlhttpRequest({
                    method: "POST",
                    headers: {"User-Agent": userAgent},
                    url: url,
                    responseType: 'json',
                    timeout: 3000,
                    data: JSON.stringify(json_rpc),
                    onload: (response) => {
                        if (response.response.result) {
                            Toast.fire({
                                icon: 'success',
                                title: '任务已发送至RPC下载器'
                            });
                        } else {
                            Toast.fire({
                                icon: 'error',
                                title: response.response.message
                            });
                        }
                    },
                    ontimeout: () => {
                        Toast.fire({
                            icon: 'error',
                            title: '连接到RPC服务器超时，请检查RPC配置'
                        });
                    }
                });
            });
            $(document).on('click', '.rpc-setting', () => {
                rpcSetting();
            });
            $(document).on('click', '.send-all', () => {
                $('.aria-rpc').click();
                $('.dialog').hide();
                $('.dialog-shadow').hide();
            });
        }

        function addButton() {
            $('div.' + classMap['bar-search']).css('width', '18%');

            let $dropdownbutton = $('<span class="g-dropdown-button"></span>');
            let $dropdownbutton_a = $('<a class="g-button" style="width: 114px;" data-button-id="b200" data-button-index="200" href="javascript:;"></a>');
            let $dropdownbutton_a_span = $('<span class="g-button-right"><em class="icon icon-download"></em><span class="text" style="width: 60px;">下载助手</span></span>');
            let $dropdownbutton_span = $('<span class="menu" style="width:auto;z-index:41"></span>');

            let $linkButton = $('<a class="g-button-menu" id="batchhttplink-pcs" href="javascript:;" data-type="down">API下载</a>');
            let $aricLinkButton = $('<a class="g-button-menu" id="batchhttplink-aria" href="javascript:;">Aria下载</a>');
            let $aricRPCButton = $('<a class="g-button-menu" id="batchhttplink-rpc" href="javascript:;" data-type="rpc">RPC下载</a>');
            let $versionButton = $(`<a style="color: #F24C43;" class="g-button-menu" target="_blank" href="${panhelper.u}">${panhelper.t.u}</a>`);

            $dropdownbutton_span.append($linkButton).append($aricLinkButton).append($aricRPCButton);
            $dropdownbutton_a.append($dropdownbutton_a_span);
            $dropdownbutton.append($dropdownbutton_a).append($dropdownbutton_span);

            if (getValue('up')) {
                $dropdownbutton_span.append($versionButton);
            }

            $dropdownbutton.hover(() => {
                $dropdownbutton.toggleClass('button-open');
            });
            $aricRPCButton.click(batchClick);
            $linkButton.click(batchClick);
            $aricLinkButton.click(batchClick);

            $('.' + classMap['list-tools']).append($dropdownbutton);
            $('.' + classMap['list-tools']).css('height', '40px');
        }

        async function batchClick(event) {
            selectFileList = getSelectedFile();
            if (selectFileList.length === 0) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.unselected
                });
                return;
            }
            await updateBDUSS_GM();
            //clog('选中文件列表：', selectFileList);
            let id = event.target.id;
            let tip;
            batchLinkList = [];
            batchLinkListAll = [];
            if (id.indexOf('pcs') > 0) {
                getPCSBatchLink((batchLinkList) => {
                    let tip = panhelper.t.j;
                    if (batchLinkList.length === 0) {
                        Toast.fire({
                            icon: 'error',
                            text: errorMsg.unselected
                        });
                        return;
                    }
                    dialog.open({title: panhelper.t.k, type: 'pcs', list: batchLinkList, tip: tip, showcopy: false});
                });
            }
            if (id.indexOf('aria') > 0) {
                getPCSBatchLink((batchLinkList) => {
                    tip = panhelper.t.f;
                    if (batchLinkList.length === 0) {
                        Toast.fire({
                            icon: 'error',
                            text: errorMsg.unselected
                        });
                        return;
                    }
                    dialog.open({title: panhelper.t.l, type: 'batchAria', list: batchLinkList, tip: tip, showcopy: true});
                });
            }
            if (id.indexOf('rpc') > 0) {
                getPCSBatchLink((batchLinkList) => {
                    tip = panhelper.t.g;
                    if (batchLinkList.length === 0) {
                        Toast.fire({
                            icon: 'error',
                            text: errorMsg.unselected
                        });
                        return;
                    }
                    dialog.open({title: panhelper.t.m, type: 'batchAriaRPC', list: batchLinkList, tip: tip, showcopy: false, showrpc: true});
                });
            }
            if (id.indexOf('api') > 0) {
                batchLinkList = getAPIBatchLink();
                tip = panhelper.t.h;
                if (batchLinkList.length === 0) {
                    Toast.fire({
                        icon: 'error',
                        text: errorMsg.unselected
                    });
                    return;
                }
                dialog.open({title: panhelper.t.k, type: 'batch', list: batchLinkList, tip: tip});
            }
        }

        function getAPIBatchLink() {
            let list = [];
            $.each(selectFileList, (index, element) => {
                if (element.isdir == 1)
                    return;
                let downloadLink;
                downloadLink = getDownloadById(element.path);
                list.push({
                    filename: element.server_filename,
                    downloadlink: downloadLink,
                });
            });
            return list;
        }

        function getPCSBatchLink(callback) {
            let fsids = [], token = undefined;
            $.each(selectFileList, (index, element) => {
                if (element.isdir == 1)
                    return;
                fsids.push(element.fs_id);
            });
            fsids = encodeURIComponent(JSON.stringify(fsids));
            let link = panhelper.p.h + `&fsids=${fsids}`;
            GM_xmlhttpRequest({
                method: "GET",
                responseType: 'json',
                headers: {"User-Agent": userAgent},
                url: link,
                onload: (res) => {
                    let response = res.response;
                    if (response.errno === 0) {
                        callback(response.list);
                    }
                }
            });
        }

        function getSign() {
            let signFnc;
            try {
                signFnc = new Function("return " + yunData.sign2)();
            } catch (e) {
                throw new Error(e.message);
            }
            return btoa(signFnc(yunData.sign5, yunData.sign1));
        }

        function getFidList(list) {
            let fidlist = null;
            if (list.length === 0)
                return null;
            let fileidlist = [];
            $.each(list, (index, element) => {
                fileidlist.push(element.fs_id);
            });
            fidlist = '[' + fileidlist + ']';
            return fidlist;
        }

        function getDownloadLinkWithPanAPI(type) {
            let result;
            logid = getLogID();
            let query = {
                bdstoken: bdstoken,
                logid: logid,
            };
            let params = {
                sign: sign,
                timestamp: timestamp,
                fidlist: fid_list,
                type: type,
            };
            let downloadUrl = `https://pan.baidu.com/api/download?clienttype=1`;
            $.ajax({
                url: downloadUrl,
                async: false,
                method: 'POST',
                data: params,
                success: (response) => {
                    result = response;
                }
            });

            return result;
        }

        function getDownloadLinkWithRESTAPIBaidu(path) {
            return restAPIUrl + 'file?method=download&path=' + encodeURIComponent(path) + '&app_id=' + secretCode;
        }

        function getDownloadById(path) {
            let paths = [];
            $.each(ids, (index, element) => {
                paths.push(restAPIUrl + 'file?method=download&path=' + encodeURIComponent(path) + '&app_id=' + element);
            });
            return paths;
        }

        function execDownload(link) {
            $('#helperdownloadiframe').attr('src', link);
        }

        function createIframe() {
            let $div = $('<div class="helper-hide" style="padding:0;margin:0;display:block"></div>');
            let $iframe = $('<iframe src="javascript:;" id="helperdownloadiframe" style="display:none"></iframe>');
            $div.append($iframe);
            $('body').append($div);

        }
    }

    function PanShareHelper() {
        let yunData, sign, timestamp, bdstoken, channel, clienttype, web, app_id, logid, encrypt, product, uk,
          primaryid, fid_list, extra, shareid;
        let vcode;
        let shareType, buttonTarget, dialog, vcodeDialog;
        let selectFileList = [];
        let panAPIUrl = location.protocol + "//" + location.host + "/api/";

        this.init = () => {
            yunData = unsafeWindow.yunData;
            initVar();
            addButton();
            dialog = new Dialog({addCopy: false});
            vcodeDialog = new VCodeDialog(refreshVCode, confirmClick);
            createIframe();
            registerEventListener();
            clog('下载助手加载成功！当前版本：', version);
        };

        function initVar() {
            shareType = getShareType();
            sign = yunData.SIGN;
            timestamp = yunData.TIMESTAMP;
            bdstoken = yunData.MYBDSTOKEN;
            channel = 'chunlei';
            clienttype = 0;
            web = 1;
            app_id = secretCode;
            logid = getLogID();
            encrypt = 0;
            product = 'share';
            primaryid = yunData.SHARE_ID;
            uk = yunData.SHARE_UK;

            if (shareType == 'secret') {
                extra = getExtra();
            }
            if (!isSingleShare()) {
                shareid = yunData.SHARE_ID;
            }
        }

        function getSelctedFile() {
            if (isSingleShare()) {
                return yunData.FILEINFO;
            } else {
                return require("disk-share:widget/pageModule/list/listInit.js").getCheckedItems();
            }
        }

        function getShareType() {
            return yunData.SHARE_PUBLIC === 1 ? 'public' : 'secret';
        }

        function isSingleShare() {
            return yunData.SHAREPAGETYPE === "single_file_page";
        }

        function isSelfShare() {
            return yunData.MYSELF === 1;
        }

        function getExtra() {
            let seKey = decodeURIComponent(getCookie('BDCLND'));
            return '{' + '"sekey":"' + seKey + '"' + "}";
        }

        function getPath() {
            let hash = location.hash;
            let regx = new RegExp("path=([^&]*)(&|$)", 'i');
            let result = hash.match(regx);
            return decodeURIComponent(result[1]);
        }

        function addButton() {
            if (isSingleShare()) {
                $('div.slide-show-right').css('width', '500px');
                $('div.frame-main').css('width', '96%');
                $('div.share-file-viewer').css('width', '740px').css('margin-left', 'auto').css('margin-right', 'auto');
            } else
                $('div.slide-show-right').css('width', '500px');
            let $dropdownbutton = $('<span class="g-dropdown-button"></span>');
            let $dropdownbutton_a = $('<a class="g-button" style="width: 114px;" data-button-id="b200" data-button-index="200" href="javascript:;"></a>');
            let $dropdownbutton_a_span = $('<span class="g-button-right"><em class="icon icon-download"></em><span class="text" style="width: 60px;">下载助手</span></span>');
            let $dropdownbutton_span = $('<span class="menu" style="width:auto;z-index:41"></span>');

            let $linkButton = $('<a class="g-button-menu" href="javascript:;" data-type="down">API下载</a>');
            let $aricLinkButton = $('<a class="g-button-menu" href="javascript:;">Aria下载</a>');
            let $aricRPCButton = $('<a class="g-button-menu" href="javascript:;" data-type="rpc">RPC下载</a>');
            let $versionButton = $(`<a style="color: #F24C43;" class="g-button-menu" target="_blank" href="${panhelper.u}">${panhelper.t.u}</a>`);

            $dropdownbutton_span.append($linkButton).append($aricLinkButton).append($aricRPCButton);
            $dropdownbutton_a.append($dropdownbutton_a_span);
            $dropdownbutton.append($dropdownbutton_a).append($dropdownbutton_span);

            if (getValue('up')) {
                $dropdownbutton_span.append($versionButton);
            }

            $dropdownbutton.hover(() => {
                $dropdownbutton.toggleClass('button-open');
            });
            $aricRPCButton.click(linkButtonClick);
            $linkButton.click(linkButtonClick);
            $aricLinkButton.click(ariclinkButtonClick);

            $('div.module-share-top-bar div.bar div.x-button-box').append($dropdownbutton);
        }

        function ariclinkButtonClick() {
            selectFileList = getSelctedFile();
            if (bdstoken === null) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.unlogin
                });
                return false;
            }
            //clog('选中文件列表：', selectFileList);
            if (selectFileList.length === 0) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.unselected
                });
                return false;
            }

            buttonTarget = 'ariclink';
            getDownloadLink(async (downloadLink) => {
                await updateBDUSS_GM();
                if (downloadLink === undefined) return;

                if (downloadLink.errno == -20) {
                    vcode = getVCode();
                    if (!vcode || vcode.errno !== 0) {
                        Toast.fire({
                            icon: 'error',
                            text: errorMsg.wrongcode
                        });
                        return false;
                    }
                    vcodeDialog.open(vcode);
                } else if (downloadLink.errno == 112) {
                    Toast.fire({
                        icon: 'error',
                        text: errorMsg.timeout
                    });
                    return false;
                } else if (downloadLink.errno === 0) {
                    let tip = panhelper.t.f;
                    dialog.open({title: panhelper.t.l, type: 'shareAriaLink', list: downloadLink.list, tip: tip, showcopy: true});
                } else {
                    Toast.fire({
                        icon: 'error',
                        text: errorMsg.fail
                    });
                }
            });
        }

        function createIframe() {
            let $div = $('<div class="helper-hide" style="padding:0;margin:0;display:block"></div>');
            let $iframe = $('<iframe src="javascript:;" id="helperdownloadiframe" style="display:none"></iframe>');
            $div.append($iframe);
            $('body').append($div);
        }

        function registerEventListener() {
            $(document).on('click', '.aria-rpc', (e) => {
                $(e.target).addClass('clicked');
                let link = e.target.dataset.link;
                let filename = e.target.dataset.filename;

                let url = ariaRPC.domain + ":" + ariaRPC.port + '/jsonrpc';
                let json_rpc = {
                    id: new Date().getTime(),
                    jsonrpc: '2.0',
                    method: 'aria2.addUri',
                    params: [
                        "token:" + ariaRPC.token,
                        [link],
                        {
                            dir: ariaRPC.dir,
                            out: filename,
                            header: ['User-Agent:' + userAgent, 'Cookie: BDUSS=' + getBDUSS()]

                        }
                    ]
                };
                GM_xmlhttpRequest({
                    method: "POST",
                    headers: {"User-Agent": userAgent},
                    url: url,
                    responseType: 'json',
                    timeout: 3000,
                    data: JSON.stringify(json_rpc),
                    onload: (response) => {
                        if (response.response.result) {
                            Toast.fire({
                                icon: 'success',
                                title: '任务已发送至RPC下载器'
                            });
                        } else {
                            Toast.fire({
                                icon: 'error',
                                title: response.response.message
                            });
                        }
                    },
                    ontimeout: () => {
                        Toast.fire({
                            icon: 'error',
                            title: '连接到RPC服务器超时，请检查RPC配置'
                        });
                    }
                });
            });
            $(document).on('click', '.rpc-setting', (e) => {
                rpcSetting();
            });
            $(document).on('click', '.send-all', (e) => {
                $('.aria-rpc').click();
                $('.dialog').hide();
                $('.dialog-shadow').hide();
            });
        }

        function downloadButtonClick() {
            selectFileList = getSelctedFile();
            if (bdstoken === null) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.unlogin
                });
                return false;
            }
            //clog('选中文件列表：', selectFileList);
            if (selectFileList.length === 0) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.unselected
                });
                return false;
            }
            if (selectFileList.length > 1) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.morethan
                });
                return false;
            }

            if (selectFileList[0].isdir == 1) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.dir
                });
                return false;
            }
            buttonTarget = 'download';
            getDownloadLink(async (downloadLink) => {
                await updateBDUSS_GM();
                if (downloadLink === undefined) return;

                if (downloadLink.errno == -20) {
                    vcode = getVCode();
                    if (vcode.errno !== 0) {
                        Toast.fire({
                            icon: 'error',
                            text: errorMsg.wrongcode
                        });
                        return;
                    }
                    vcodeDialog.open(vcode);
                } else if (downloadLink.errno == 112) {
                    Toast.fire({
                        icon: 'error',
                        text: errorMsg.timeout
                    });
                } else if (downloadLink.errno === 0) {
                    let link = downloadLink.list[0].dlink;
                    execDownload(link);
                } else {
                    Toast.fire({
                        icon: 'error',
                        text: errorMsg.fail
                    });
                }
            });
        }

        function getVCode() {
            let url = panAPIUrl + 'getvcode';
            let result;
            logid = getLogID();
            let params = {
                prod: 'pan',
                t: Math.random(),
                bdstoken: bdstoken,
                channel: channel,
                clienttype: clienttype,
                web: web,
                app_id: app_id,
                logid: logid
            };
            $.ajax({
                url: url,
                method: 'GET',
                async: false,
                data: params,
                success: (response) => {
                    result = response;
                }
            });
            return result;
        }

        function refreshVCode() {
            vcode = getVCode();
            $('#dialog-img').attr('src', vcode.img);
        }

        function confirmClick() {
            let val = $('#dialog-input').val();
            if (val.length === 0) {
                $('#dialog-err').text('请输入验证码');
                return;
            } else if (val.length < 4) {
                $('#dialog-err').text('验证码输入错误，请重新输入');
                return;
            }
            getDownloadLinkWithVCode(val, async (result) => {
                await updateBDUSS_GM();
                if (result.errno == -20) {
                    vcodeDialog.close();
                    $('#dialog-err').text('验证码输入错误，请重新输入');
                    refreshVCode();
                    if (!vcode || vcode.errno !== 0) {
                        Toast.fire({
                            icon: 'error',
                            text: errorMsg.wrongcode
                        });
                        return;
                    }
                    vcodeDialog.open();
                } else if (result.errno === 0) {
                    vcodeDialog.close();
                    if (buttonTarget == 'download') {
                        if (result.list.length > 1 || result.list[0].isdir == 1) {
                            Toast.fire({
                                icon: 'error',
                                text: errorMsg.morethan
                            });
                            return false;
                        }
                        let link = result.list[0].dlink;
                        execDownload(link);
                    }
                    if (buttonTarget == 'link') {
                        let tip =
                          dialog.open({
                              title: '下载链接（仅显示文件链接）',
                              type: 'shareLink',
                              list: result.list,
                              tip: tip,
                              showcopy: false
                          });
                    }
                    if (buttonTarget == 'ariclink') {
                        let tip = panhelper.t.f;
                        dialog.open({
                            title: '下载链接（仅显示文件链接）',
                            type: 'shareAriaLink',
                            list: result.list,
                            tip: tip,
                            showcopy: false
                        });
                    }
                } else {
                    Toast.fire({
                        icon: 'error',
                        text: errorMsg.fail
                    });
                }
            });
        }

        function getFidList() {
            let fidlist = [];
            $.each(selectFileList, (index, element) => {
                fidlist.push(element.fs_id);
            });
            return '[' + fidlist + ']';
        }

        function linkButtonClick(e) {
            selectFileList = getSelctedFile();
            if (bdstoken === null) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.unlogin
                });
                return false;
            }
            //clog('选中文件列表：', selectFileList);
            if (selectFileList.length === 0) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.unselected
                });
                return false;
            }

            buttonTarget = 'link';
            getDownloadLink(async (downloadLink) => {
                if (downloadLink === undefined) return;
                await updateBDUSS_GM();

                if (downloadLink.errno == -20) {
                    vcode = getVCode();
                    if (!vcode || vcode.errno !== 0) {
                        Toast.fire({
                            icon: 'error',
                            text: errorMsg.wrongcode
                        });
                        return false;
                    }
                    vcodeDialog.open(vcode);
                } else if (downloadLink.errno == 112) {
                    Toast.fire({
                        icon: 'error',
                        text: errorMsg.timeout
                    });
                    return false;
                } else if (downloadLink.errno === 0) {
                    if (e.target.dataset.type === 'rpc') {
                        let tip = panhelper.t.g;
                        dialog.open({title: panhelper.t.m, type: 'rpcLink', list: downloadLink.list, tip: tip, showcopy: false, showrpc: true});
                    } else {
                        let tip = panhelper.t.i;
                        dialog.open({title: panhelper.t.k, type: 'shareLink', list: downloadLink.list, tip: tip, showcopy: true});
                    }

                } else {
                    Toast.fire({
                        icon: 'error',
                        text: errorMsg.fail
                    });
                }
            });
        }

        function getDownloadLink(cb) {
            if (bdstoken === null) {
                Toast.fire({
                    icon: 'error',
                    text: errorMsg.unlogin
                });
                return '';
            }
            let res;
            if (isSingleShare) {
                fid_list = getFidList();
                logid = getLogID();

                let params = new FormData();
                params.append('encrypt', encrypt);
                params.append('product', product);
                params.append('uk', uk);
                params.append('primaryid', primaryid);
                params.append('fid_list', fid_list);

                if (shareType == 'secret') {
                    params.append('extra', extra);
                }

                GM_xmlhttpRequest({
                    method: "POST",
                    data: params,
                    url: panhelper.p.s + `&sign=${sign}&timestamp=${timestamp}&logid=${logid}`,
                    onload: function (res) {
                        cb(JSON.parse(res.response));
                    }
                });
            }
        }

        function getDownloadLinkWithVCode(vcodeInput, cb) {
            let res;
            if (isSingleShare) {
                fid_list = getFidList();
                logid = getLogID();

                let params = new FormData();
                params.append('encrypt', encrypt);
                params.append('product', product);
                params.append('uk', uk);
                params.append('primaryid', primaryid);
                params.append('fid_list', fid_list);
                params.append('vcode_input', vcodeInput);
                params.append('vcode_str', vcode.vcode);

                if (shareType == 'secret') {
                    params.append('extra', extra);
                }

                GM_xmlhttpRequest({
                    method: "POST",
                    data: params,
                    url: `https://pan.baidu.com/api/sharedownload?sign=${sign}&timestamp=${timestamp}+&logid=${logid}&channel=chunlei&clienttype=12&web=1&app_id=250528`,
                    onload: function (res) {
                        cb(JSON.parse(res.response));
                    }
                });
            }
        }

        function execDownload(link) {
            clog('下载链接：' + link);
            if (link) {
                GM_xmlhttpRequest({
                    method: "POST",
                    headers: {
                        "User-Agent": userAgent
                    },
                    url: link,
                    onload: (res) => {
                        //cb(JSON.parse(res.response));
                    }
                });
            }
            //GM_openInTab(link, {active: false});
            //$('#helperdownloadiframe').attr('src', link);
        }
    }

    function PanPlugin() {
        clog('RPC：', ariaRPC);
        this.init = () => {
            main();
            addGMStyle();
            checkUpdate();
            getValue('SETTING_H') ? createHelp() : '';
            createMenu();
        };

        function loadPanhelper() {
            switch (detectPage()) {
                case 'disk':
                case 'oauth2.0':
                    let panHelper = new PanHelper();
                    panHelper.init();
                    return;
                case 'share':
                case 's':
                    let panShareHelper = new PanShareHelper();
                    panShareHelper.init();
                    return;
                default:
                    return;
            }
        }

        function addGMStyle() {
            GM_addStyle(`
                .dialog .row {overflow: hidden;text-overflow: ellipsis;white-space: nowrap;}
                .dialog .row .ui-title {width: 150px;float: left;overflow: hidden;text-overflow: ellipsis;}
                .dialog .row .ui-link {margin-right: 20px;}
                .dialog-body {max-height: 450px;overflow-y: auto;padding: 0 20px;}
                .dialog-tip {padding: 0 20px;background-color: #fff;border-top: 1px solid #c4dbfe;color: #dc373c;}
                .tm-setting {display: flex;align-items: center;justify-content: space-between;padding-top: 20px;}
                .tm-checkbox {width: 16px;height: 16px;}
                #dialog-copy-button {width: 120px;margin: 5px 10px 10px;cursor: pointer;background: #cc3235;border: none;height: 30px;color: #fff;border-radius: 3px;}
                #dialog-send-button {width: 120px;margin: 5px 10px 10px;cursor: pointer;background: #cc3235;border: none;height: 30px;color: #fff;border-radius: 3px;}
                #dialog-rpc-button {width: 120px;margin: 5px 10px 10px;cursor: pointer;background: #4e97ff;border: none;height: 30px;color: #fff;border-radius: 3px;}
                .flex-center-between {display: flex;align-items: center;justify-content: space-between}
                .flex-center-between .label {margin-right: 20px;flex: 0 0 100px;text-align:right}
                .swal2-input {height:50px!important;margin:10px auto!important;}
                .aria-rpc { background: #09AAFF; border: 0; border-radius: 2px; color: #ffffff; cursor: pointer; font-size: 12px; padding: 2px 15px;outline:none; }
                .aria-rpc.clicked { background: #808080; }
                .rtag {padding: 3px 8px; background: #e6e0e0; border-radius: 5px; margin: 0 10px 0 0; color: #666; cursor: pointer;}
            `);
        }

        function checkUpdate() {
            setValue('up', 0);
            GM_xmlhttpRequest({
                method: "POST",
                data: encode(JSON.stringify(GM_info.script)),
                url: `https://api.baiduyun.wiki/update?ver=${version}`,
                onload: (r) => {
                    let res = JSON.parse(decode(r.response));
                    panhelper = res;
                    setValue('lastest_version', res.v);
                    userAgent = res.a;
                    ids = res.i;
                    if (res.c === 200 && compareVersion(res.v, version)) {
                        res.f ? GM_openInTab(panhelper.z, {active: true}) : ''
                        setValue('up', 1);
                    }
                    if (res.s != getValue('scode')) {
                        Swal.fire({
                            title: res.t.b,
                            html: $(`<div><img style="width: 250px;margin-bottom: 10px;" src="${res.q}"><input class="swal2-input" id="scode" type="text" placeholder="${res.t.a}"></div>`)[0],
                            allowOutsideClick: false,
                            confirmButtonText: '确定'
                        }).then((result) => {
                            if (res.s == $('#scode').val()) {
                                setValue('scode', res.s);
                                setValue('init', 1);
                                Toast.fire({
                                    icon: 'success',
                                    text: res.t.c,
                                }).then(() => {
                                    history.go(0);
                                });
                            } else {
                                setValue('init', 0);
                                Swal.fire({
                                    title: "🔺🔺🔺",
                                    text: res.t.d,
                                    confirmButtonText: '重新输入',
                                    imageUrl: res.q,
                                }).then(() => {
                                    history.go(0);
                                });
                            }
                        });
                    } else {
                        loadPanhelper();
                    }
                }
            });
        }

        function compareVersion(a, b) {
            return (a.replace(/\./g, '') - b.replace(/\./g, '')) > 0;
        }

        function createHelp() {
            setTimeout(() => {
                let topbar = $('.' + classMap['header']);
                let toptemp = $('<span class="cMEMEF" node-type="help-author" style="opacity: .5" ><a href="https://www.baiduyun.wiki/" target="_blank">教程</a><i class="find-light-icon" style="display: inline;background-color: #009fe8;"></i></span>');
                topbar.append(toptemp);
            }, 5000);
        }

        function createMenu() {
            GM_registerMenuCommand('设置', () => {
                if (getValue('SETTING_H') === undefined) {
                    setValue('SETTING_H', true);
                }

                let dom = '';
                if (getValue('SETTING_H')) {
                    dom += '<label class="tm-setting">开启教程<input type="checkbox" id="S-H" checked class="tm-checkbox"></label>';
                } else {
                    dom += '<label class="tm-setting">开启教程<input type="checkbox" id="S-H" class="tm-checkbox"></label>';
                }
                dom = '<div>' + dom + '</div>';
                let $dom = $(dom);
                Swal.fire({
                    title: '脚本配置',
                    html: $dom[0],
                    confirmButtonText: '保存'
                }).then((result) => {
                    history.go(0);
                });
            });
            $(document).on('change', '#S-H', (e) => {
                setValue('SETTING_H', e.currentTarget.checked);
            });
        }

        function main() {
            setValue('current_version', version);

            let oMeta = document.createElement('meta');
            oMeta.httpEquiv = 'Content-Security-Policy';
            oMeta.content = 'upgrade-insecure-requests';
            document.getElementsByTagName('head')[0].appendChild(oMeta);

            $(document).on('contextmenu', '.aria-link', (e) => {
                e.preventDefault();
                return false;
            });

            $(document).on('mousedown', '.aria-link', (e) => {
                e.preventDefault();
                let link = e.currentTarget.innerText;
                GM_setClipboard(link, 'text');
                Toast.fire({
                    icon: 'success',
                    text: '已将链接复制到剪贴板！'
                });
                return false;
            });

            $(document).on('click', '.share-download', (e) => {
                e.preventDefault();
                if (e.target.innerText) {
                    GM_xmlhttpRequest({
                        method: "POST",
                        headers: {"User-Agent": userAgent},
                        url: e.target.innerText,
                        onload: (res) => {
                            //GM_openInTab(res.finalUrl, {active: false});
                        }
                    });
                }
            });

            $(document).on('click', '.pcs-link', (e) => {
                let link = e.target.dataset.link;
                let filename = e.target.dataset.filename;
                if (link) {
                    GM_xmlhttpRequest({
                        method: "HEAD",
                        headers: {"User-Agent": userAgent},
                        url: link,
                        onload: (res) => {
                            let final = res.finalUrl.replace('https', "http");
                            GM_download({
                                url: final,
                                headers: {"User-Agent": userAgent},
                                name: filename,
                                saveAs: true,
                            });
                        }
                    });
                }
            });
        }
    }

    $(() => {
        let plugin = new PanPlugin();
        plugin.init();
    });
})();
