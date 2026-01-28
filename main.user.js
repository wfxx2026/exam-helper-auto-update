// ==UserScript==
// @name         全员答题-（半自动交卷版30题）
// @namespace    https://github.com/yourname
// @version      3.6
// @description  自动答题0.1秒(模拟考试^手机考试)适配30题 | 支持GitHub在线更新
// @author       © 2026 晚风叙信 ✯
// @icon         https://i.imgs.ovh/2026/01/27/yslWBh.jpeg
// @match        http://61.150.84.25:100/*
// @match        http://*/Content/ExamOnlineTest/*
// @match        http://*/*/ExamManger/OnlineTest/*
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/wfxx2026/exam-helper-auto-update/main/main.user.js
// @downloadURL  https://raw.githubusercontent.com/wfxx2026/exam-helper-auto-update/main/main.user.js
// ==/UserScript==
(function() {
    'use strict';
    // ==================== 全局状态管理 ====================
    window._examHelperInitialized = window._examHelperInitialized || false;
    window._examHelperElements = window._examHelperElements || {
        badge: null,
        startBtn: null,
        stopBtn: null,
        checkBtn: null,
        infoBtn: null,
        statusDiv: null,
        rankBtn: null
    };
    window._autoSubmitEnabled = false;
    
    // ==================== 身份证授权系统（双重验证版） ====================
    const IDCardAuth = {
        encryptedIDs: [
            "fXVveWdneWZydGlu"  
        ],
        config: {
            expireDate: "2026-12-31",
            version: "3.7",
            maxActivations: 50,
            activationLockHours: 24
        },
        secretKey: "ID_AUTH_KEY_2026_V3",
        encryptIDCard: function(idCard) {
            try {
                idCard = idCard.replace(/[\s-]/g, '').toUpperCase();
                if (!/^\d{15}$/.test(idCard) && !/^\d{17}[\dX]$/.test(idCard)) {
                    return null;
                }
                if (idCard.length === 15) {
                    idCard = idCard.substring(0, 6) + '19' + idCard.substring(6);
                    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
                    const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
                    let sum = 0;
                    for (let i = 0; i < 17; i++) {
                        sum += parseInt(idCard.charAt(i)) * weights[i];
                    }
                    const checkCode = checkCodes[sum % 11];
                    idCard = idCard.substring(0, 17) + checkCode;
                }
                let encrypted = "";
                const key = this.secretKey;
                for (let i = 0; i < idCard.length; i++) {
                    const keyChar = key.charCodeAt(i % key.length);
                    const idChar = idCard.charCodeAt(i);
                    const encryptedChar = idChar ^ keyChar;
                    encrypted += String.fromCharCode(encryptedChar);
                }
                let base64;
                try {
                    base64 = btoa(encrypted);
                } catch (e) {
                    return null;
                }
                const cleanBase64 = base64.replace(/[^a-zA-Z0-9]/g, '');
                const result = cleanBase64.substring(0, 16);
                return result;
            } catch (error) {
                console.error("加密过程中出错:", error);
                return null;
            }
        },
        validateIDCard: function(idCard) {
            idCard = idCard.trim().toUpperCase();
            if (!/^\d{15}$/.test(idCard) && !/^\d{17}[\dX]$/.test(idCard)) {
                return {
                    valid: false,
                    message: "身份证格式不正确，请输入15位或18位身份证号"
                };
            }
            const encryptedID = this.encryptIDCard(idCard);
            if (!encryptedID) {
                return {
                    valid: false,
                    message: "身份证加密失败，请检查输入"
                };
            }
            const isAuthorized = this.encryptedIDs.includes(encryptedID);
            if (isAuthorized) {
                return {
                    valid: true,
                    message: "身份证验证成功",
                    encryptedID: encryptedID,
                    plainID: idCard
                };
            }
            return {
                valid: false,
                message: "该身份证未授权，请联系管理员获取授权"
            };
        },
        getPageIDCard: function() {
            console.log("🔍 尝试从页面获取用户身份证号...");
            const idSelectors = [
                "input[type='hidden'][id*='id']",
                "input[type='hidden'][name*='id']",
                "input[type='hidden'][value*='610525']",
                "#xxidnumber", "#idNumber", "#IDNumber", "#sfzh", "#SFZH",
                "#userIdCard", "#userIDCard", "#user_idcard",
                "[name='xxidnumber']", "[name='idNumber']", "[name='IDNumber']",
                "[name='sfzh']", "[name='SFZH']", "[name='userIdCard']",
                ".xxidnumber", ".id-number", ".ID-number", ".sfzh", ".SFZH",
                ".user-idcard", ".user-id-card",
                "body", "div", "span", "td", "label"
            ];
            for (const selector of idSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        let idCard = "";
                        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                            idCard = element.value || element.getAttribute('value');
                        } else if (element.hasAttribute('data-value')) {
                            idCard = element.getAttribute('data-value');
                        } else {
                            idCard = element.textContent || element.innerText;
                        }
                        if (idCard) {
                            const idMatch = idCard.toString().match(/\b\d{15}\b|\b\d{17}[\dX]\b/);
                            if (idMatch) {
                                idCard = idMatch[0].trim().replace(/[\s-]/g, '').toUpperCase();
                                if (/^\d{15}$/.test(idCard) || /^\d{17}[\dX]$/.test(idCard)) {
                                    console.log(`✅ 找到页面身份证号: ${this.maskIDCard(idCard)} (选择器: ${selector})`);
                                    return idCard;
                                }
                            }
                        }
                    }
                } catch (e) {
                }
            }
            console.log("❌ 未在页面中找到用户身份证号");
            return null;
        },
        validatePageIDCard: function(activatedIDCard) {
            const pageIDCard = this.getPageIDCard();
            if (!pageIDCard) {
                console.log("❌ 页面中未找到用户身份证号");
                return {
                    valid: false,
                    message: "页面中未找到您的身份证号，请确保您已登录正确的账户"
                };
            }
            const cleanActivated = activatedIDCard.replace(/[\s-]/g, '').toUpperCase();
            const cleanPage = pageIDCard.replace(/[\s-]/g, '').toUpperCase();
            console.log("🔍 验证页面身份证号匹配:");
            console.log("  激活的身份证:", this.maskIDCard(cleanActivated));
            console.log("  页面的身份证:", this.maskIDCard(cleanPage));
            if (cleanActivated === cleanPage) {
                console.log("✅ 页面身份证号匹配成功");
                return {
                    valid: true,
                    message: "身份验证通过",
                    pageIDCard: pageIDCard
                };
            } else {
                console.log("❌ 页面身份证号不匹配");
                return {
                    valid: false,
                    message: `身份证号不匹配<br>激活的身份证: ${this.maskIDCard(cleanActivated)}<br>页面中的身份证: ${this.maskIDCard(cleanPage)}`
                };
            }
        },
        storageKeys: {
            licenseCode: "exam_bot_license_code",
            licensePlainText: "exam_bot_license_plain_text",
            activatedDate: "exam_bot_activated_date",
            failedAttempts: "exam_bot_failed_attempts",
            lastAttemptTime: "exam_bot_last_attempt_time",
            activationCount: "exam_bot_activation_count",
            pageIDCardVerified: "exam_bot_page_id_verified",
            videoPageInitialized: "exam_bot_video_page_init"
        },
        isVideoPage: function() {
            const hasVideo = document.querySelector('video, iframe[src*="video"], .video-player, .video-container') !== null;
            const pageText = document.body.textContent || '';
            const hasVideoText = pageText.includes('视频') || pageText.includes('video') || pageText.includes('Video');
            const hasVideoUrl = window.location.href.includes('video') || 
                              document.querySelector('body[class*="video"]') !== null;
            return hasVideo || hasVideoText || hasVideoUrl;
        },
        checkAuthorization: function() {
            console.log("🔍 检查授权状态...");
            const savedID = GM_getValue(this.storageKeys.licenseCode, null);
            const savedPlain = GM_getValue(this.storageKeys.licensePlainText, null);
            const activationDate = GM_getValue(this.storageKeys.activatedDate, null);
            const pageVerified = GM_getValue(this.storageKeys.pageIDCardVerified, false);
            const isVideoPage = this.isVideoPage();
            console.log("🔍 保存的加密ID:", savedID);
            console.log("🔍 保存的明文身份证:", savedPlain);
            console.log("🔍 页面验证状态:", pageVerified);
            console.log("🔍 是否是视频题页面:", isVideoPage);
            if (savedID && savedPlain && activationDate) {
                const isInList = this.encryptedIDs.includes(savedID);
                console.log("🔍 保存的ID是否在列表中:", isInList);
                if (isInList) {
                    const today = new Date().toISOString().split('T')[0];
                    if (today <= this.config.expireDate) {
                        console.log("✅ 已授权用户:", this.maskIDCard(savedPlain));
                        if (isVideoPage) {
                            console.log("🎥 视频题页面，跳过页面身份证验证");
                            return {
                                status: "authorized",
                                idCard: savedPlain,
                                encryptedID: savedID,
                                activationDate: activationDate,
                                isVideoPage: true
                            };
                        }
                        if (!pageVerified) {
                            console.log("⚠️ 需要重新验证页面身份证号");
                            return { 
                                status: "needs_page_verification",
                                idCard: savedPlain,
                                encryptedID: savedID,
                                activationDate: activationDate
                            };
                        }
                        return {
                            status: "authorized",
                            idCard: savedPlain,
                            encryptedID: savedID,
                            activationDate: activationDate
                        };
                    } else {
                        console.log("❌ 授权已过期");
                        return { status: "expired" };
                    }
                } else {
                    console.log("❌ 保存的授权码不在授权列表中");
                }
            }
            console.log("❌ 未授权或授权信息不完整");
            return { status: "not_authorized" };
        },
        activateIDCard: function(idCard) {
            const validation = this.validateIDCard(idCard);
            if (validation.valid) {
                const activationCount = GM_getValue(this.storageKeys.activationCount, 0);
                if (activationCount >= this.config.maxActivations) {
                    return { success: false, message: "已达到最大激活次数限制" };
                }
                const pageValidation = this.validatePageIDCard(validation.plainID);
                if (!pageValidation.valid) {
                    return {
                        success: false,
                        message: pageValidation.message,
                        needsPageVerification: true
                    };
                }
                GM_setValue(this.storageKeys.licenseCode, validation.encryptedID);
                GM_setValue(this.storageKeys.licensePlainText, validation.plainID);
                GM_setValue(this.storageKeys.activatedDate, new Date().toISOString().split('T')[0]);
                GM_setValue(this.storageKeys.pageIDCardVerified, true);
                const currentCount = GM_getValue(this.storageKeys.activationCount, 0);
                GM_setValue(this.storageKeys.activationCount, currentCount + 1);
                GM_setValue(this.storageKeys.failedAttempts, 0);
                console.log("✅ 身份证双重验证成功:", validation.plainID);
                return {
                    success: true,
                    message: "身份证双重验证成功！"
                };
            }
            this.recordFailedAttempt();
            return {
                success: false,
                message: validation.message
            };
        },
        verifyPageIDCard: function() {
            const savedPlain = GM_getValue(this.storageKeys.licensePlainText, null);
            if (!savedPlain) {
                return { success: false, message: "未找到激活的身份证号" };
            }
            const validation = this.validatePageIDCard(savedPlain);
            if (validation.valid) {
                GM_setValue(this.storageKeys.pageIDCardVerified, true);
                return { success: true, message: "页面身份证验证成功" };
            } else {
                return { success: false, message: validation.message };
            }
        },
        recordFailedAttempt: function() {
            const currentAttempts = GM_getValue(this.storageKeys.failedAttempts, 0);
            const newAttempts = currentAttempts + 1;
            GM_setValue(this.storageKeys.failedAttempts, newAttempts);
            GM_setValue(this.storageKeys.lastAttemptTime, Date.now());
            if (newAttempts >= 100) {
                console.warn("⚠️ 连续100次激活失败，已锁定");
            }
        },
        isLocked: function() {
            const failedAttempts = GM_getValue(this.storageKeys.failedAttempts, 0);
            const lastAttemptTime = GM_getValue(this.storageKeys.lastAttemptTime, 0);
            if (failedAttempts >= 10) {
                const lockTime = this.config.activationLockHours * 60 * 60 * 1000;
                const timeSinceLastAttempt = Date.now() - lastAttemptTime;
                if (timeSinceLastAttempt < lockTime) {
                    const remainingHours = Math.ceil((lockTime - timeSinceLastAttempt) / (60 * 60 * 1000));
                    return {
                        locked: true,
                        remainingHours: remainingHours
                    };
                } else {
                    GM_setValue(this.storageKeys.failedAttempts, 0);
                }
            }
            return { locked: false };
        },
        maskIDCard: function(idCard) {
            if (!idCard) return "未授权";
            if (idCard.length === 18) {
                return idCard.substring(0, 6) + "********" + idCard.substring(14);
            }
            return idCard.substring(0, 6) + "********";
        },
        getStatusInfo: function() {
            const auth = this.checkAuthorization();
            const activationCount = GM_getValue(this.storageKeys.activationCount, 0);
            const failedAttempts = GM_getValue(this.storageKeys.failedAttempts, 0);
            const pageVerified = GM_getValue(this.storageKeys.pageIDCardVerified, false);
            return {
                authorized: auth.status === "authorized",
                needsPageVerification: auth.status === "needs_page_verification",
                idCard: auth.idCard ? this.maskIDCard(auth.idCard) : null,
                activationDate: auth.activationDate,
                expireDate: this.config.expireDate,
                version: this.config.version,
                remainingActivations: this.config.maxActivations - activationCount,
                failedAttempts: failedAttempts,
                pageVerified: pageVerified,
                isVideoPage: auth.isVideoPage || false
            };
        },
        getAvailableLicenseCount: function() {
            return this.encryptedIDs.length;
        }
    };
    
    // ==================== 排名查询功能 ====================
    const RankQuery = {
        // 兼容版padStart
        padStart: (str, length, padChar = '0') => String(str).padStart(length, padChar),
        
        // 加密函数（平台接口必填）
        esdt: (code) => {
            let c = "";
            const l = [];
            for (const char of code) {
                const temp = char.charCodeAt(0);
                l.push(String(temp.toString().length));
                c += String(temp);
            }
            return `${c}^${l.join(',')}`;
        },
        
        // 日期工具（获取当月起止日期）
        getMonthDateRange: () => {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const beginDate = `${year}-${RankQuery.padStart(month + 1, 2)}-01`;
            const endDate = new Date(year, month + 1, 0);
            const endDateStr = `${endDate.getFullYear()}-${RankQuery.padStart(endDate.getMonth() + 1, 2, '0')}-${RankQuery.padStart(endDate.getDate(), 2, '0')}`;
            return { beginDate, endDateStr };
        },
        
        // PushPlus推送
        async sendPushPlusMsg(msg) {
            const token = "658dcbe6a91f480f99ec181e6c633221";
            const url = "https://www.pushplus.plus/send";
            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        token: token,
                        title: "全员答题积分排名查询通知",
                        content: msg.replace(/\n/g, "<br>"),
                        template: "html",
                        channel: "wechat"
                    }),
                    mode: "cors",
                    cache: "no-cache"
                });

                const resData = await res.json();
                if (resData.code === 200) {
                    alert("✅ 排名积分已推送至PushPlus（微信可查）");
                    return true;
                } else {
                    alert(`⚠️ 推送失败：${resData.msg}`);
                    return false;
                }
            } catch (err) {
                alert(`❌ 推送网络错误：${err.message}\n建议：确认手机能访问PushPlus官网`);
                return false;
            }
        },
        
        // 消息格式化
        formatMsg(userRankData, totalUsers, rank) {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth() + 1;
            
            let msg = `<h3>📊 澄合矿山救护队全员答题月度积分排名</h3>`;
            msg += `<p>📅 统计月份：${year}年${month}月</p>`;
            msg += `<hr style="border:1px solid #eee;">`;
            
            if (!userRankData) {
                msg += `<p style="color:red;">❌ 未找到您的排名数据</p>`;
            } else {
                msg += `<table border="1" bordercolor="#eee" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">`;
                msg += `<tr style="background:#f5f5f5;"><th>排名</th><th>姓名</th><th>部门</th><th>积分</th></tr>`;
                
                const name = userRankData.PersonName || userRankData.name || '未知用户';
                const dept = userRankData.DepartmentFullName || userRankData.deptName || userRankData.DepartmentName || '未知部门';
                const score = userRankData.AllCount || userRankData.totalScore || userRankData.Score || 0;
                
                msg += `<tr><td>${rank}</td><td>${name}</td><td>${dept}</td><td>${score}</td></tr>`;
                msg += `</table>`;
                msg += `<p style="margin-top:10px;">📈 总参与人数：${totalUsers}</p>`;
            }
            
            msg += `<hr style="border:1px solid #eee;">`;
            msg += `<p>💡 数据来源：陕西煤业-素质兴安平台</p>`;
            return msg;
        },
        
        // 获取当前页面的Cookie
        getCurrentCookie: () => {
            return document.cookie || '';
        },
        
        // 获取当前用户信息（从页面中提取）
        getCurrentUserInfo: () => {
            console.log("🔍 尝试从页面获取用户信息...");
            
            // 优先尝试从常见位置获取用户名
            const nameSelectors = [
                "#PersonName", ".person-name", "[name='PersonName']",
                "#UserName", ".user-name", "[name='UserName']",
                "#name", ".name", "[name='name']",
                ".user-info", ".exam-user", ".user-info span",
                "h1", "h2", "h3", ".title",
                "td", ".td-text", ".info-text"
            ];
            
            let userName = "";
            let userIdCard = IDCardAuth.getPageIDCard();
            
            // 尝试获取用户名
            for (const selector of nameSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (element && element.offsetParent !== null) { // 确保元素可见
                            const text = element.textContent || element.innerText || element.value || "";
                            const cleanText = text.trim().replace(/\s+/g, ' ');
                            if (cleanText && cleanText.length > 1 && cleanText.length < 20) {
                                // 排除非姓名的文本
                                const excludeKeywords = ['登录', '注册', '密码', '首页', '返回', '确定', '取消', '提交', '搜索', '查询'];
                                const isExcluded = excludeKeywords.some(keyword => cleanText.includes(keyword));
                                if (!isExcluded && !cleanText.match(/^[\d\s]+$/) && !cleanText.includes('@')) {
                                    console.log(`✅ 找到可能的用户名: "${cleanText}" (选择器: ${selector})`);
                                    userName = cleanText;
                                    break;
                                }
                            }
                        }
                    }
                    if (userName) break;
                } catch (e) {
                    console.log(`选择器 ${selector} 查询出错:`, e);
                }
            }
            
            // 如果没有找到用户名，尝试从页面文本中查找
            if (!userName) {
                console.log("⚠️ 未通过选择器找到用户名，尝试从页面文本中查找...");
                const allText = document.body.innerText || document.body.textContent || '';
                const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                
                // 常见的中文姓名模式
                const namePatterns = [
                    /姓名[:：]\s*([^\s]{2,4})/,
                    /姓名\s*[:：]\s*([^\s]{2,4})/,
                    /([\u4e00-\u9fa5]{2,4})\s*同志/,
                    /([\u4e00-\u9fa5]{2,4})\s*先生/,
                    /([\u4e00-\u9fa5]{2,4})\s*女士/,
                    /欢迎,\s*([\u4e00-\u9fa5]{2,4})/,
                    /用户[:：]\s*([^\s]{2,4})/,
                    /用户\s*[:：]\s*([^\s]{2,4})/
                ];
                
                for (const line of lines) {
                    for (const pattern of namePatterns) {
                        const match = line.match(pattern);
                        if (match && match[1]) {
                            console.log(`✅ 通过正则找到用户名: "${match[1]}"`);
                            userName = match[1];
                            break;
                        }
                    }
                    if (userName) break;
                }
            }
            
            return {
                name: userName || "未知用户",
                idCard: userIdCard
            };
        },
        
        // 查找用户排名 - 改进的匹配逻辑
        findUserInRankData: function(data, userInfo) {
            if (!data || !Array.isArray(data) || data.length === 0) {
                console.log("❌ 排名数据为空或格式错误");
                return null;
            }
            
            console.log("🔍 开始匹配用户信息...");
            console.log("用户信息:", userInfo);
            
            // 查看数据结构（调试用）
            const firstItem = data[0];
            console.log("排名数据结构示例:", Object.keys(firstItem));
            
            // 收集所有可能的字段名
            const fields = Object.keys(firstItem);
            console.log("可用字段:", fields);
            
            // 查找可能的姓名字段
            const nameFields = fields.filter(f => 
                f.toLowerCase().includes('name') || 
                f.toLowerCase().includes('person') ||
                f.toLowerCase().includes('xm') ||
                f.includes('姓名') ||
                f.includes('Name')
            );
            console.log("可能的姓名字段:", nameFields);
            
            // 查找可能的身份证字段
            const idFields = fields.filter(f => 
                f.toLowerCase().includes('idcard') || 
                f.toLowerCase().includes('card') ||
                f.toLowerCase().includes('sfzh') ||
                f.includes('身份证') ||
                f.includes('Card')
            );
            console.log("可能的身份证字段:", idFields);
            
            // 查找可能的部门字段
            const deptFields = fields.filter(f => 
                f.toLowerCase().includes('dept') || 
                f.toLowerCase().includes('department') ||
                f.includes('部门') ||
                f.includes('单位')
            );
            console.log("可能的部门字段:", deptFields);
            
            // 尝试多种匹配策略
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                
                // 1. 首先尝试通过身份证号精确匹配
                if (userInfo.idCard) {
                    for (const field of idFields) {
                        const fieldValue = String(item[field] || '').trim().toUpperCase();
                        if (fieldValue === userInfo.idCard) {
                            console.log(`✅ 通过身份证号精确匹配成功 (${field}: ${fieldValue})`);
                            return { index: i, data: item };
                        }
                        
                        // 尝试模糊匹配（身份证号部分匹配）
                        if (fieldValue && fieldValue.includes(userInfo.idCard.substring(6, 14))) {
                            console.log(`✅ 通过身份证号模糊匹配成功 (${field}: ${fieldValue})`);
                            return { index: i, data: item };
                        }
                    }
                }
                
                // 2. 尝试通过姓名精确匹配
                if (userInfo.name && userInfo.name !== "未知用户") {
                    for (const field of nameFields) {
                        const fieldValue = String(item[field] || '').trim();
                        if (fieldValue === userInfo.name) {
                            console.log(`✅ 通过姓名精确匹配成功 (${field}: ${fieldValue})`);
                            return { index: i, data: item };
                        }
                    }
                }
                
                // 3. 尝试通过姓名包含匹配
                if (userInfo.name && userInfo.name !== "未知用户") {
                    for (const field of nameFields) {
                        const fieldValue = String(item[field] || '').trim();
                        if (fieldValue && userInfo.name.includes(fieldValue)) {
                            console.log(`✅ 通过姓名包含匹配成功 (${field}: ${fieldValue})`);
                            return { index: i, data: item };
                        }
                        if (fieldValue && fieldValue.includes(userInfo.name)) {
                            console.log(`✅ 通过字段包含姓名匹配成功 (${field}: ${fieldValue})`);
                            return { index: i, data: item };
                        }
                    }
                }
                
                // 4. 尝试通过姓名的部分匹配（比如去掉姓氏）
                if (userInfo.name && userInfo.name !== "未知用户" && userInfo.name.length > 1) {
                    const nameWithoutFirstChar = userInfo.name.substring(1);
                    if (nameWithoutFirstChar.length > 0) {
                        for (const field of nameFields) {
                            const fieldValue = String(item[field] || '').trim();
                            if (fieldValue && fieldValue.includes(nameWithoutFirstChar)) {
                                console.log(`✅ 通过姓名部分匹配成功 (${field}: ${fieldValue})`);
                                return { index: i, data: item };
                            }
                        }
                    }
                }
            }
            
            // 5. 如果以上都没匹配到，尝试显示前几条数据供用户确认
            console.log("⚠️ 自动匹配失败，显示前5条数据供参考:");
            for (let i = 0; i < Math.min(5, data.length); i++) {
                const item = data[i];
                const name = nameFields.map(f => item[f]).find(v => v) || '未知';
                const dept = deptFields.map(f => item[f]).find(v => v) || '未知';
                console.log(`  第${i+1}条: ${name} - ${dept}`);
            }
            
            return null;
        },
        
        // 核心查询逻辑 - 查询当前用户排名
        async queryMyRanking() {
            const statusDiv = document.getElementById('exam-helper-status');
            if (statusDiv) {
                statusDiv.textContent = '正在查询排名...';
                statusDiv.className = 'exam-helper-status show';
            }
            
            const { beginDate, endDateStr } = this.getMonthDateRange();
            const url = "http://61.150.84.25:100/ArchiveManger/D_PersonAccumulate/GetAccumulateRankingListOne";
            
            // 获取当前用户信息
            const userInfo = this.getCurrentUserInfo();
            console.log("当前用户信息:", userInfo);
            
            if (!userInfo.idCard) {
                console.warn("⚠️ 未获取到身份证号，将尝试通过姓名匹配");
            }
            
            const data = new URLSearchParams();
            data.append("pid", this.esdt("5bc4ffbb-a00d-479f-a72b-7455cbc539f8"));
            data.append("page", "1");
            data.append("rows", "200"); // 获取200条数据
            data.append("begin", this.esdt(beginDate));
            data.append("end", this.esdt(endDateStr));
            data.append("type", "1"); // 1=本单位
            
            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Cookie": this.getCurrentCookie(),
                        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
                        "Referer": "http://61.150.84.25:100/PersonWap/Index",
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: data,
                    credentials: "include"
                });

                if (!res.ok) {
                    throw new Error(`平台接口请求失败（状态码：${res.status}）`);
                }
                
                const resData = await res.json();
                console.log("排名接口返回数据:", resData);
                
                if (!resData.data || !resData.data.length) {
                    alert("❌ 暂无排名数据\n可能本月尚未有人参与答题");
                    if (statusDiv) statusDiv.className = 'exam-helper-status';
                    return;
                }
                
                // 查找当前用户
                const userMatch = this.findUserInRankData(resData.data, userInfo);
                
                if (userMatch) {
                    const userRankData = userMatch.data;
                    const rank = userMatch.index + 1;
                    
                    // 显示结果
                    const rankMsg = `📊 您的月度排名查询结果\n` +
                                   `🏆 排名：第 ${rank} 名\n` +
                                   `👤 姓名：${userRankData.PersonName || userRankData.name || '未知'}\n` +
                                   `🏢 部门：${userRankData.DepartmentFullName || userRankData.deptName || userRankData.DepartmentName || '未知'}\n` +
                                   `⭐ 积分：${userRankData.AllCount || userRankData.totalScore || userRankData.Score || 0}\n` +
                                   `📈 总人数：${resData.total || resData.data.length}\n` +
                                   `📅 统计周期：${beginDate} 至 ${endDateStr}`;
                    
                    alert(rankMsg);
                    
                    // 询问是否推送
                    const needPush = confirm("🔔 是否将排名结果推送至PushPlus？");
                    if (needPush) {
                        const htmlMsg = this.formatMsg(userRankData, resData.total || resData.data.length, rank);
                        await this.sendPushPlusMsg(htmlMsg);
                    }
                    
                    if (statusDiv) {
                        statusDiv.textContent = `✅ 排名查询完成：第${rank}名`;
                        setTimeout(() => {
                            statusDiv.className = 'exam-helper-status';
                        }, 3000);
                    }
                } else {
                    // 显示排名数据让用户手动查找
                    let previewText = "🔍 未自动匹配到您的排名，以下是前10名数据：\n\n";
                    for (let i = 0; i < Math.min(10, resData.data.length); i++) {
                        const item = resData.data[i];
                        const name = item.PersonName || item.name || '未知';
                        const dept = item.DepartmentFullName || item.deptName || item.DepartmentName || '未知';
                        const score = item.AllCount || item.totalScore || item.Score || 0;
                        previewText += `${i+1}. ${name} - ${dept} - ${score}分\n`;
                    }
                    
                    previewText += `\n📊 总数据量：${resData.data.length}条\n`;
                    previewText += `\n可能原因：\n1. 您本月尚未参与答题\n2. 系统数据尚未更新\n3. 用户信息不匹配`;
                    
                    alert(previewText);
                    
                    // 提供手动搜索选项
                    const userInput = prompt("请输入您的姓名进行手动搜索（支持模糊搜索）:", userInfo.name);
                    if (userInput && userInput.trim()) {
                        // 手动搜索
                        let found = false;
                        for (let i = 0; i < resData.data.length; i++) {
                            const item = resData.data[i];
                            const itemName = item.PersonName || item.name || '';
                            if (itemName && itemName.includes(userInput.trim())) {
                                const rankMsg = `✅ 找到匹配结果：\n` +
                                              `🏆 排名：第 ${i+1} 名\n` +
                                              `👤 姓名：${itemName}\n` +
                                              `🏢 部门：${item.DepartmentFullName || item.deptName || item.DepartmentName || '未知'}\n` +
                                              `⭐ 积分：${item.AllCount || item.totalScore || item.Score || 0}`;
                                alert(rankMsg);
                                found = true;
                                
                                // 询问是否推送
                                const needPush = confirm("🔔 是否将排名结果推送至PushPlus？");
                                if (needPush) {
                                    const htmlMsg = this.formatMsg(item, resData.data.length, i+1);
                                    await this.sendPushPlusMsg(htmlMsg);
                                }
                                break;
                            }
                        }
                        
                        if (!found) {
                            alert("❌ 未找到匹配的姓名，请确认输入正确");
                        }
                    }
                    
                    if (statusDiv) statusDiv.className = 'exam-helper-status';
                }
                
            } catch (err) {
                console.error("排名查询错误:", err);
                alert(`查询失败：${err.message}\n请检查网络连接或稍后重试`);
                if (statusDiv) statusDiv.className = 'exam-helper-status';
            }
        }
    };

    // ==================== 主程序 ====================
    console.log('🚀 启动全员答题系统 v3.7（适配30题+排名查询）');
    
    if (window._examHelperInitialized) {
        console.log('⚠️ 脚本已初始化，跳过重复执行');
        return;
    }
    
    const authStatus = IDCardAuth.checkAuthorization();
    if (authStatus.status === "authorized") {
        console.log('✅ 身份证双重验证通过，加载答题功能...');
        window._examHelperInitialized = true;
        initializeMainProgram();
    } else if (authStatus.status === "needs_page_verification") {
        console.log('⚠️ 需要重新验证页面身份证号...');
        if (IDCardAuth.isVideoPage()) {
            console.log('🎥 视频题页面，跳过重新验证');
            window._examHelperInitialized = true;
            initializeMainProgram();
        } else {
            showPageVerificationRequired(authStatus.idCard);
        }
    } else if (authStatus.status === "expired") {
        showExpiredMessage();
    } else {
        console.log('🔐 需要授权，显示授权界面...');
        showIDCardAuth();
    }

    // ==================== 主功能（适配30题） ====================
    function initializeMainProgram() {
        console.log('🎯 初始化答题功能（适配30题）...');
        const authStatus = IDCardAuth.checkAuthorization();
        if (authStatus.status !== "authorized") {
            console.error('❌ 授权状态异常，无法初始化答题功能');
            return;
        }
        
        if (!IDCardAuth.isVideoPage()) {
            const pageValidation = IDCardAuth.validatePageIDCard(authStatus.idCard);
            if (!pageValidation.valid) {
                console.error('❌ 页面身份证号验证失败，无法使用答题功能');
                showPageVerificationRequired(authStatus.idCard);
                return;
            }
        }
        
        console.log('✅ 双重验证通过，开始加载答题功能');
        cleanupExistingElements();
        
        if (!document.getElementById('exam-helper-styles')) {
            GM_addStyle(`
                #exam-helper-styles {
                    display: none;
                }
                .exam-helper-btn {
                    position: fixed;
                    z-index: 9998;
                    padding: 8px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    transition: all 0.3s ease;
                    border: none;
                    outline: none;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    opacity: 0.7;
                    backdrop-filter: blur(5px);
                    pointer-events: auto;
                }
                .exam-helper-btn:hover {
                    opacity: 1;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                .exam-helper-btn-start {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    right: 20px;
                    bottom: 200px;
                }
                .exam-helper-btn-stop {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                    right: 20px;
                    bottom: 150px;
                }
                .exam-helper-btn-check {
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                    color: white;
                    right: 20px;
                    bottom: 100px;
                }
                .exam-helper-btn-auto-submit {
                    background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%);
                    color: white;
                    right: 20px;
                    bottom: 50px;
                }
                .exam-helper-btn-auto-submit.active {
                    background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%);
                }
                .exam-helper-btn-info {
                    background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%);
                    color: white;
                    right: 20px;
                    bottom: 300px;
                    opacity: 0.5;
                    font-size: 10px;
                    padding: 5px 10px;
                }
                .exam-helper-btn-info:hover {
                    opacity: 1;
                }
                .exam-helper-btn-rank {
                    background: linear-gradient(135deg, #9C27B0 0%, #E91E63 100%);
                    color: white;
                    right: 20px;
                    bottom: 250px;
                }
                .exam-helper-status {
                    position: fixed;
                    right: 20px;
                    top: 80px;
                    background: rgba(0,0,0,0.7);
                    color: white;
                    padding: 6px 10px;
                    border-radius: 6px;
                    font-size: 10px;
                    z-index: 9997;
                    display: none;
                    max-width: 200px;
                    backdrop-filter: blur(5px);
                    font-family: 'Microsoft YaHei', sans-serif;
                    border-left: 2px solid #00b09b;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .exam-helper-status.show {
                    display: block;
                    opacity: 1;
                    animation: fadeInStatus 0.3s ease-out;
                }
                @keyframes fadeInStatus {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .exam-helper-auth-badge {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(0, 176, 155, 0.8);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 15px;
                    font-size: 10px;
                    z-index: 9996;
                    font-family: 'Microsoft YaHei', sans-serif;
                    backdrop-filter: blur(5px);
                    opacity: 0.7;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    pointer-events: auto;
                }
                .exam-helper-auth-badge:hover {
                    opacity: 1;
                }
                .exam-helper-video-mode .exam-helper-btn {
                    opacity: 0.3;
                }
                .exam-helper-video-mode .exam-helper-btn:hover {
                    opacity: 0.8;
                }
                .exam-helper-video-mode .exam-helper-auth-badge {
                    background: rgba(102, 126, 234, 0.8);
                }
            `);
            const styleTag = document.createElement('style');
            styleTag.id = 'exam-helper-styles';
            document.head.appendChild(styleTag);
        }
        
        function cleanupExistingElements() {
            const elementsToRemove = [
                'exam-helper-auth-badge',
                'exam-helper-start',
                'exam-helper-stop', 
                'exam-helper-check',
                'exam-helper-info',
                'exam-helper-status',
                'exam-helper-auto-submit',
                'exam-helper-rank'
            ];
            elementsToRemove.forEach(id => {
                const element = document.getElementById(id);
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            });
            window._examHelperElements = {
                badge: null,
                startBtn: null,
                stopBtn: null,
                checkBtn: null,
                infoBtn: null,
                statusDiv: null,
                rankBtn: null
            };
        }
        
        function createAuthBadge() {
            if (document.getElementById('exam-helper-auth-badge')) {
                return;
            }
            const statusInfo = IDCardAuth.getStatusInfo();
            const maskedID = IDCardAuth.maskIDCard(statusInfo.idCard);
            const badge = document.createElement('div');
            badge.id = 'exam-helper-auth-badge';
            badge.className = 'exam-helper-auth-badge';
            if (statusInfo.isVideoPage) {
                badge.classList.add('video-mode');
            }
            badge.innerHTML = `
                <span style="font-size: 12px;">${statusInfo.isVideoPage ? '🔥' : '✓'}</span>
                <span>${maskedID.substring(12)}</span>
            `;
            badge.title = statusInfo.isVideoPage ? '起飞模式' : '双重验证通过（30题适配）';
            document.body.appendChild(badge);
            window._examHelperElements.badge = badge;
            badge.addEventListener('click', function(e) {
                e.stopPropagation();
                showLicenseInfo();
            });
        }
        
        function showLicenseInfo() {
            const existingPopup = document.getElementById('license-info-popup');
            if (existingPopup && existingPopup.parentNode) {
                existingPopup.parentNode.removeChild(existingPopup);
            }
            const statusInfo = IDCardAuth.getStatusInfo();
            const pageIDCard = IDCardAuth.getPageIDCard();
            const infoDiv = document.createElement('div');
            infoDiv.id = 'license-info-popup';
            infoDiv.className = 'exam-helper-status show';
            infoDiv.style.top = '40px';
            infoDiv.style.right = '10px';
            infoDiv.style.maxWidth = '250px';
            let infoContent = `
                <div style="margin-bottom: 5px; font-weight: bold; font-size: 11px;">双重验证信息（30题适配）</div>
                <div style="margin-bottom: 3px; font-size: 9px;">
                    <span style="opacity: 0.7;">激活:</span> ${IDCardAuth.maskIDCard(statusInfo.idCard)}
                </div>
            `;
            if (statusInfo.isVideoPage) {
                infoContent += `
                    <div style="margin-bottom: 3px; font-size: 9px; color: #667eea;">
                        <span style="opacity: 0.7;">模式:</span> 🔥 起飞模式
                    </div>
                `;
            } else {
                infoContent += `
                    <div style="margin-bottom: 3px; font-size: 9px;">
                        <span style="opacity: 0.7;">页面:</span> ${pageIDCard ? IDCardAuth.maskIDCard(pageIDCard) : '未检测'}
                    </div>
                `;
            }
            infoContent += `
                <div style="margin-bottom: 3px; font-size: 9px;">
                    <span style="opacity: 0.7;">到期:</span> ${statusInfo.expireDate}
                </div>
                <div style="margin-bottom: 3px; font-size: 9px; color: #4facfe;">
                    <span style="opacity: 0.7;">适配:</span> 30题模式
                </div>
                <div style="margin-top: 5px; font-size: 8px; opacity: 0.5; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">
                    点击任意处关闭
                </div>
            `;
            infoDiv.innerHTML = infoContent;
            document.body.appendChild(infoDiv);
            setTimeout(() => {
                const closeInfo = function(e) {
                    const popup = document.getElementById('license-info-popup');
                    const badge = document.getElementById('exam-helper-auth-badge');
                    if (popup && popup.parentNode && 
                        !popup.contains(e.target) && 
                        (!badge || !badge.contains(e.target))) {
                        popup.style.opacity = '0';
                        setTimeout(() => {
                            if (popup.parentNode) {
                                popup.parentNode.removeChild(popup);
                            }
                        }, 300);
                        document.removeEventListener('click', closeInfo);
                    }
                };
                document.addEventListener('click', closeInfo);
            }, 100);
        }
        
        function createControlPanel() {
            const elements = [
                'exam-helper-status',
                'exam-helper-info',
                'exam-helper-check', 
                'exam-helper-start',
                'exam-helper-stop',
                'exam-helper-auto-submit',
                'exam-helper-rank'
            ];
            
            if (elements.some(id => document.getElementById(id))) {
                console.log('⚠️ 控制面板元素已存在，跳过创建');
                return;
            }
            
            // 状态显示
            const statusDiv = document.createElement('div');
            statusDiv.id = 'exam-helper-status';
            statusDiv.className = 'exam-helper-status';
            document.body.appendChild(statusDiv);
            window._examHelperElements.statusDiv = statusDiv;
            
            // 信息按钮
            const infoBtn = document.createElement('button');
            infoBtn.id = 'exam-helper-info';
            infoBtn.className = 'exam-helper-btn exam-helper-btn-info';
            infoBtn.innerHTML = 'ℹ️';
            infoBtn.title = '显示授权信息';
            document.body.appendChild(infoBtn);
            window._examHelperElements.infoBtn = infoBtn;
            
            // 排名查询按钮
            const rankBtn = document.createElement('button');
            rankBtn.id = 'exam-helper-rank';
            rankBtn.className = 'exam-helper-btn exam-helper-btn-rank';
            rankBtn.innerHTML = '📊排名查询';
            rankBtn.title = '查询我的月度排名 (Ctrl+Alt+R)';
            document.body.appendChild(rankBtn);
            window._examHelperElements.rankBtn = rankBtn;
            
            // 开始答题按钮
            const startBtn = document.createElement('button');
            startBtn.id = 'exam-helper-start';
            startBtn.className = 'exam-helper-btn exam-helper-btn-start';
            startBtn.innerHTML = '▶开始答题(30题)';
            startBtn.title = '开始自动答题 (Ctrl+Alt+S)';
            document.body.appendChild(startBtn);
            window._examHelperElements.startBtn = startBtn;
            
            // 停止答题按钮
            const stopBtn = document.createElement('button');
            stopBtn.id = 'exam-helper-stop';
            stopBtn.className = 'exam-helper-btn exam-helper-btn-stop';
            stopBtn.innerHTML = '停止答题';
            stopBtn.title = '停止自动答题 (Ctrl+Alt+P)';
            stopBtn.style.display = 'none';
            document.body.appendChild(stopBtn);
            window._examHelperElements.stopBtn = stopBtn;
            
            // 检查按钮
            const checkBtn = document.createElement('button');
            checkBtn.id = 'exam-helper-check';
            checkBtn.className = 'exam-helper-btn exam-helper-btn-check';
            checkBtn.innerHTML = '✓检查进度';
            checkBtn.title = '检查已答题目 (Ctrl+Alt+C)';
            document.body.appendChild(checkBtn);
            window._examHelperElements.checkBtn = checkBtn;
            
            // 自动交卷按钮
            const autoSubmitBtn = document.createElement('button');
            autoSubmitBtn.id = 'exam-helper-auto-submit';
            autoSubmitBtn.className = 'exam-helper-btn exam-helper-btn-auto-submit';
            autoSubmitBtn.innerHTML = '⚡自动交卷(关)';
            autoSubmitBtn.title = '开启/关闭答完自动交卷 (Ctrl+Alt+A)';
            document.body.appendChild(autoSubmitBtn);
            
            // 绑定自动交卷开关事件
            autoSubmitBtn.addEventListener('click', function() {
                window._autoSubmitEnabled = !window._autoSubmitEnabled;
                if (window._autoSubmitEnabled) {
                    this.innerHTML = '⚡自动交卷(开)';
                    this.classList.add('active');
                    showStatus('✅ 自动交卷已开启', 2000);
                } else {
                    this.innerHTML = '⚡自动交卷(关)';
                    this.classList.remove('active');
                    showStatus('⏹️ 自动交卷已关闭', 2000);
                }
            });
        }
        
        function showStatus(message, duration = 2000) {
            const statusDiv = document.getElementById('exam-helper-status');
            if (!statusDiv) return;
            statusDiv.textContent = message;
            statusDiv.className = 'exam-helper-status show';
            if (duration > 0) {
                setTimeout(() => {
                    statusDiv.className = 'exam-helper-status';
                }, duration);
            }
        }
        
        // 获取当前显示的题目编号
        function getCurrentQuestionNumber() {
            if (window.onlineCur) {
                return parseInt(window.onlineCur);
            }
            const visibleQuestion = document.querySelector('.single-box[style*="display: block"]');
            if (visibleQuestion) {
                const link = visibleQuestion.querySelector('a[name]');
                if (link) {
                    return parseInt(link.name);
                }
            }
            const currentLink = document.querySelector('.single-main a');
            if (currentLink && currentLink.name) {
                return parseInt(currentLink.name);
            }
            return 1;
        }
        
        // 跳转到指定题目
        function goToQuestion(qNum) {
            if (typeof window.move2 === 'function') {
                window.move2(qNum);
                return qNum;
            }
            if (typeof window.BJ === 'function') {
                window.BJ(qNum.toString());
            }
            const panelBtn = document.getElementById(`${qNum}aa`);
            if (panelBtn) {
                document.querySelectorAll('.title_num a').forEach(btn => {
                    btn.className = 'btn btn-default';
                });
                panelBtn.className = 'btn btn-primary';
            }
            return qNum;
        }
        
        // 获取标准答案
        function getCorrectAnswer(questionId) {
            const answerInput = document.getElementById(`${questionId}bzda`);
            return answerInput ? answerInput.value.trim() : null;
        }
        
        // 答题函数
        function answerQuestion(questionId) {
            const correctAnswer = getCorrectAnswer(questionId);
            if (!correctAnswer) {
                console.warn(`第 ${questionId} 题没有找到答案`);
                return false;
            }
            let answered = false;
            if (correctAnswer.length === 1 && ['A','B','C','D'].includes(correctAnswer)) {
                const optionIndex = correctAnswer.charCodeAt(0) - 65 + 1;
                const radioId = `${questionId}|${optionIndex}`;
                const radio = document.getElementById(radioId);
                if (radio) {
                    radio.click();
                    answered = true;
                }
            } else if (correctAnswer.length > 1 && correctAnswer.split('').every(c => ['A','B','C','D','E','F','G','H'].includes(c))) {
                for (let letter of correctAnswer) {
                    const optionIndex = letter.charCodeAt(0) - 65 + 1;
                    const checkboxId = `${questionId}|${optionIndex}`;
                    const checkbox = document.getElementById(checkboxId);
                    if (checkbox) {
                        checkbox.click();
                        answered = true;
                    }
                }
            } else if (correctAnswer === '对' || correctAnswer === '错' || correctAnswer === 'Y' || correctAnswer === 'N') {
                let optionIndex = 1;
                if (correctAnswer === '错' || correctAnswer === 'N') {
                    optionIndex = 2;
                }
                const radioId = `${questionId}|${optionIndex}`;
                const radio = document.getElementById(radioId);
                if (radio) {
                    radio.click();
                    answered = true;
                }
            }
            if (answered) {
                const panelBtn = document.getElementById(`${questionId}aa`);
                if (panelBtn) {
                    panelBtn.className = 'btn btn-success';
                }
            }
            return answered;
        }
        
        // 翻到下一题
        function goToNextQuestion() {
            if (typeof window.questionsAdd === 'function') {
                window.questionsAdd();
                return true;
            }
            if (typeof window.ToNext === 'function') {
                window.ToNext();
                return true;
            }
            const nextBtn = document.querySelector('a[onclick*="questionsAdd"]');
            if (nextBtn) {
                nextBtn.click();
                return true;
            }
            return false;
        }
        
        // 自动交卷+结束考试完整流程
        function autoSubmitAndFinishExam() {
            console.log('📤 执行自动交卷+结束考试流程...');
            showStatus('📤 正在交卷，请稍候...', 3000);
            
            try {
                // 第一步：触发交卷
                if (typeof window.JiaoJuan === 'function') {
                    console.log('✅ 调用页面交卷函数 JiaoJuan()');
                    window.JiaoJuan();
                } else {
                    const submitBtn = document.querySelector('.overtest, #Img2, [onclick*="JiaoJuan"]');
                    if (submitBtn) {
                        console.log('✅ 点击交卷按钮');
                        submitBtn.click();
                    } else if (window.vData?.ksmxid && window.vData?.PersonId) {
                        console.log('✅ 跳转交卷接口');
                        window.location.href = `/Bus/ExamManger/OnlineTest/JiaoJuan?ksmxid=${window.vData.ksmxid}&personId=${window.vData.PersonId}`;
                        return;
                    }
                }

                // 第二步：监听交卷确认弹窗，自动确认
                setTimeout(() => {
                    const confirmBtn = document.querySelector('[onclick*="JiaoJuan"][data-dismiss="modal"]');
                    if (confirmBtn) {
                        console.log('✅ 确认交卷');
                        confirmBtn.click();
                        
                        // 第三步：交卷成功后，自动点击"结束考试"
                        setTimeout(() => {
                            if (typeof window.SleepClose === 'function') {
                                console.log('✅ 调用结束考试函数 SleepClose()');
                                window.SleepClose();
                                showStatus('🎉 考试已结束！', 5000);
                                return;
                            }
                            
                            const finishBtn = document.getElementById('btnClose');
                            if (finishBtn) {
                                console.log('✅ 点击结束考试按钮');
                                finishBtn.click();
                                showStatus('🎉 考试已结束！', 5000);
                                return;
                            }
                            
                            const otherFinishBtn = document.querySelector('.btn-danger[onclick*="SleepClose"], [data-dismiss="modal"].btn-danger');
                            if (otherFinishBtn) {
                                console.log('✅ 点击其他结束考试按钮');
                                otherFinishBtn.click();
                                showStatus('🎉 考试已结束！', 5000);
                                return;
                            }
                            
                            showStatus('✅ 交卷成功，请手动点击"结束考试"', 5000);
                        }, 1500);
                    } else {
                        setTimeout(() => {
                            if (typeof window.SleepClose === 'function') {
                                window.SleepClose();
                                showStatus('🎉 交卷并结束考试成功！', 5000);
                            } else {
                                showStatus('✅ 交卷成功，请手动结束考试', 5000);
                            }
                        }, 1000);
                    }
                }, 1000);
            } catch (e) {
                console.error('❌ 交卷流程出错:', e);
                showStatus('❌ 交卷失败，请手动操作', 5000);
            }
        }
        
        // 自动答题主函数
        function startAutoAnswer() {
            const authStatus = IDCardAuth.checkAuthorization();
            if (authStatus.status !== "authorized") {
                showStatus('❌ 验证失效，请重新登录');
                return;
            }
            let currentQuestion = getCurrentQuestionNumber();
            const totalQuestions = 30;
            const interval = 100;
            const stopBtn = document.getElementById('exam-helper-stop');
            const startBtn = document.getElementById('exam-helper-start');
            if (stopBtn) stopBtn.style.display = 'block';
            if (startBtn) startBtn.style.display = 'none';
            showStatus('🚀 开始答题(30题)...');
            
            if (window._examHelperTimer) {
                clearInterval(window._examHelperTimer);
            }
            
            window._examHelperTimer = setInterval(() => {
                if (currentQuestion > totalQuestions) {
                    clearInterval(window._examHelperTimer);
                    window._examHelperTimer = null;
                    showStatus('🎉 30题已全部完成！', 3000);
                    // 开启自动交卷则执行完整流程
                    if (window._autoSubmitEnabled) {
                        setTimeout(autoSubmitAndFinishExam, 1500);
                    }
                    if (stopBtn) stopBtn.style.display = 'none';
                    if (startBtn) startBtn.style.display = 'block';
                    return;
                }
                
                goToQuestion(currentQuestion);
                setTimeout(() => {
                    const answered = answerQuestion(currentQuestion);
                    if (answered) {
                        showStatus(`✅ 第 ${currentQuestion}/30 题`, 800);
                    } else {
                        showStatus(`⏭️ 第 ${currentQuestion}/30 题`, 800);
                    }
                    setTimeout(() => {
                        goToNextQuestion();
                        currentQuestion++;
                    }, 100);
                }, 100);
            }, interval);
        }
        
        // 停止答题
        function stopAutoAnswer() {
            if (window._examHelperTimer) {
                clearInterval(window._examHelperTimer);
                window._examHelperTimer = null;
            }
            showStatus('⏹️ 已停止', 2000);
            const stopBtn = document.getElementById('exam-helper-stop');
            const startBtn = document.getElementById('exam-helper-start');
            if (stopBtn) stopBtn.style.display = 'none';
            if (startBtn) startBtn.style.display = 'block';
        }
        
        // 检查已答题目
        function checkAnsweredQuestions() {
            let answeredCount = 0;
            showStatus('🔍 检查中(30题)...', 2000);
            for (let i = 1; i <= 30; i++) {
                const panelBtn = document.getElementById(`${i}aa`);
                if (panelBtn && panelBtn.className.includes('btn-success')) {
                    answeredCount++;
                }
            }
            showStatus(`📊 ${answeredCount}/30 题已答`, 3000);
        }
        
        // 主程序初始化
        function init() {
            console.log('🎯 初始化答题助手主程序（30题适配）');
            const isVideoPage = IDCardAuth.isVideoPage();
            if (isVideoPage) {
                console.log('🔥 检测到视频题页面，启用特殊模式');
                document.body.classList.add('exam-helper-video-mode');
            }
            
            createAuthBadge();
            createControlPanel();
            
            // 获取按钮元素
            const startBtn = document.getElementById('exam-helper-start');
            const stopBtn = document.getElementById('exam-helper-stop');
            const checkBtn = document.getElementById('exam-helper-check');
            const infoBtn = document.getElementById('exam-helper-info');
            const rankBtn = document.getElementById('exam-helper-rank');
            
            // 绑定事件
            if (startBtn && !startBtn._hasListener) {
                startBtn.addEventListener('click', function() {
                    showStatus('🚀 开始答题(30题)...', 1000);
                    setTimeout(startAutoAnswer, 500);
                });
                startBtn._hasListener = true;
            }
            
            if (stopBtn && !stopBtn._hasListener) {
                stopBtn.addEventListener('click', stopAutoAnswer);
                stopBtn._hasListener = true;
            }
            
            if (checkBtn && !checkBtn._hasListener) {
                checkBtn.addEventListener('click', checkAnsweredQuestions);
                checkBtn._hasListener = true;
            }
            
            if (infoBtn && !infoBtn._hasListener) {
                infoBtn.addEventListener('click', showLicenseInfo);
                infoBtn._hasListener = true;
            }
            
            // 绑定排名查询按钮
            if (rankBtn && !rankBtn._hasListener) {
                rankBtn.addEventListener('click', function() {
                    showStatus('📊 正在查询排名...', 1000);
                    setTimeout(() => {
                        RankQuery.queryMyRanking();
                    }, 500);
                });
                rankBtn._hasListener = true;
            }
            
            showStatus('✅ 助手已就绪(30题+排名查询)', 2000);
            
            // 键盘快捷键
            if (!document._examHelperKeyListener) {
                document.addEventListener('keydown', function(e) {
                    if (e.ctrlKey && e.altKey && e.key === 's') {
                        startAutoAnswer();
                    }
                    if (e.ctrlKey && e.altKey && e.key === 'p') {
                        stopAutoAnswer();
                    }
                    if (e.ctrlKey && e.altKey && e.key === 'c') {
                        checkAnsweredQuestions();
                    }
                    if (e.ctrlKey && e.altKey && e.key === 'a') {
                        document.getElementById('exam-helper-auto-submit').click();
                    }
                    // 新增排名查询快捷键
                    if (e.ctrlKey && e.altKey && e.key === 'r') {
                        document.getElementById('exam-helper-rank').click();
                    }
                });
                document._examHelperKeyListener = true;
            }
            
            console.log('🎉 答题助手已完全加载（30题适配+排名查询）');
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(init, 1500);
            });
        } else {
            setTimeout(init, 1500);
        }
    }
    
    // ==================== 其他辅助函数 ====================
    function showPageVerificationRequired(idCard) {
        const verifyDiv = document.createElement('div');
        verifyDiv.id = 'page-verification';
        verifyDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Microsoft YaHei', sans-serif;
        `;
        verifyDiv.innerHTML = `
            <div style="
                background: rgba(255, 255, 255, 0.95);
                border-radius: 20px;
                padding: 40px;
                width: 90%;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            ">
                <div style="margin-bottom: 30px;">
                    <div style="font-size: 60px; margin-bottom: 10px;">🔄</div>
                    <div style="font-size: 24px; font-weight: bold; color: #333; margin-bottom: 10px;">需要重新验证身份</div>
                    <div style="font-size: 14px; color: #666; margin-bottom: 25px;">
                        系统检测到页面身份信息可能已变更<br>
                        需要重新验证您的身份信息
                    </div>
                </div>
                <div style="margin-bottom: 25px; padding: 20px; background: #f8f9fa; border-radius: 12px;">
                    <div style="font-size: 14px; color: #333; margin-bottom: 10px;">已激活的身份证:</div>
                    <div style="font-family: monospace; font-size: 18px; font-weight: bold; color: #667eea;">
                        ${IDCardAuth.maskIDCard(idCard)}
                    </div>
                </div>
                <div style="margin-bottom: 30px;">
                    <button id="verify-page-btn" style="
                        background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%);
                        color: white;
                        border: none;
                        padding: 16px 40px;
                        border-radius: 25px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        width: 100%;
                        margin-bottom: 15px;
                    ">重新验证页面身份</button>
                    <button id="logout-btn" style="
                        background: #f8f9fa;
                        color: #666;
                        border: 1px solid #ddd;
                        padding: 12px 30px;
                        border-radius: 25px;
                        font-size: 14px;
                        cursor: pointer;
                        width: 100%;
                    ">退出当前账户</button>
                </div>
            </div>
        `;
        document.body.appendChild(verifyDiv);
        document.getElementById('verify-page-btn').addEventListener('click', function() {
            this.innerHTML = '验证中...';
            this.disabled = true;
            setTimeout(() => {
                const result = IDCardAuth.verifyPageIDCard();
                if (result.success) {
                    this.innerHTML = '✅ 验证成功';
                    this.style.background = 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)';
                    setTimeout(() => {
                        verifyDiv.remove();
                        location.reload();
                    }, 1000);
                } else {
                    this.innerHTML = '重新验证页面身份';
                    this.disabled = false;
                }
            }, 500);
        });
        document.getElementById('logout-btn').addEventListener('click', function() {
            GM_setValue(IDCardAuth.storageKeys.licenseCode, null);
            GM_setValue(IDCardAuth.storageKeys.licensePlainText, null);
            GM_setValue(IDCardAuth.storageKeys.pageIDCardVerified, false);
            verifyDiv.remove();
            setTimeout(() => {
                location.reload();
            }, 300);
        });
    }
    
    function showLockedMessage(hours) {
        const lockedDiv = document.createElement('div');
        lockedDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Microsoft YaHei', sans-serif;
            color: white;
        `;
        lockedDiv.innerHTML = `
            <div style="text-align: center; padding: 30px;">
                <div style="font-size: 60px; margin-bottom: 20px;">🔒</div>
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">激活功能已锁定</div>
                <div style="font-size: 16px; margin-bottom: 20px; opacity: 0.9;">
                    由于多次验证失败，系统已暂时锁定
                </div>
                <div style="
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 25px;
                    max-width: 300px;
                ">
                    <div style="font-size: 14px; margin-bottom: 5px;">剩余锁定时间:</div>
                    <div style="font-size: 28px; font-weight: bold;">${hours} 小时</div>
                </div>
                <button id="try-again-btn" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                ">返回重新验证</button>
            </div>
        `;
        document.body.appendChild(lockedDiv);
        document.getElementById('try-again-btn').addEventListener('click', function() {
            location.reload();
        });
    }
    
    function showExpiredMessage() {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Microsoft YaHei', sans-serif;
            color: white;
        `;
        div.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 60px; margin-bottom: 20px;">⏰</div>
                <div style="font-size: 28px; font-weight: bold; margin-bottom: 15px;">授权已过期</div>
                <div style="font-size: 16px; margin-bottom: 30px; opacity: 0.9;">
                    授权已于 ${IDCardAuth.config.expireDate} 到期
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }
    
    // ==================== 授权界面 ====================
    function showIDCardAuth() {
        const lockStatus = IDCardAuth.isLocked();
        if (lockStatus.locked) {
            showLockedMessage(lockStatus.remainingHours);
            return;
        }
        
        const authDiv = document.createElement('div');
        authDiv.id = 'license-auth';
        authDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Microsoft YaHei', sans-serif;
        `;
        
        const statusInfo = IDCardAuth.getStatusInfo();
        authDiv.innerHTML = `
            <div style="
                background: rgba(255, 255, 255, 0.95);
                border-radius: 20px;
                padding: 40px;
                width: 90%;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                position: relative;
                z-index: 10000;
            ">
                <div style="margin-bottom: 30px;">
                    <div style="font-size: 30px; margin-bottom: 10px;">🔐</div>
                    <div style="font-size: 24px; font-weight: bold; color: #333; margin-bottom: 10px;">身份证双重验证</div>
                    <div style="font-size: 14px; color: #666; margin-bottom: 25px;">
                        请输入您的身份证号激活全员答题助手<br>
                        <span style="color: #ff6b6b; font-weight: bold;">（需要与页面中的身份证号一致）</span>
                    </div>
                </div>
                <div style="margin-bottom: 25px;">
                    <input 
                        type="text" 
                        id="idcard-input" 
                        placeholder="请输入15位或18位身份证号"
                        maxlength="18"
                        autocomplete="off"
                        style="
                            width: 100%;
                            padding: 16px;
                            border: 2px solid #e1e5e9;
                            border-radius: 12px;
                            font-size: 18px;
                            text-align: center;
                            font-family: monospace;
                            letter-spacing: 1px;
                            box-sizing: border-box;
                        "
                    >
                    <div id="license-error" style="
                        color: #ff4757;
                        font-size: 12px;
                        margin-top: 8px;
                        min-height: 18px;
                        display: none;
                    "></div>
                    <div id="page-id-info" style="
                        margin-top: 15px;
                        padding: 10px;
                        background: #f8f9fa;
                        border-radius: 8px;
                        font-size: 12px;
                        color: #666;
                        display: none;
                    ">
                        <div>📋 <strong>页面检测到的身份证号:</strong></div>
                        <div id="page-id-value" style="margin-top: 5px; font-family: monospace; font-size: 14px;"></div>
                        <div style="margin-top: 8px; font-size: 11px; color: #999;">
                            请确保输入的身份证号与页面中的一致
                        </div>
                    </div>
                </div>
                <div style="margin-bottom: 30px;">
                    <button id="activate-btn" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 16px 40px;
                        border-radius: 25px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        width: 100%;
                        transition: all 0.3s;
                    ">开始双重验证</button>
                    <div style="margin-top: 15px;">
                        <a href="#" id="detect-page-id" style="
                            color: #667eea;
                            font-size: 14px;
                            text-decoration: none;
                        ">检测页面身份证号</a>
                        <span style="color: #999; margin: 0 10px;">|</span>
                        <a href="#" id="help-link" style="
                            color: #667eea;
                            font-size: 14px;
                            text-decoration: none;
                        ">使用帮助</a>
                    </div>
                </div>
                <div style="
                    background: #f8f9fa;
                    border-radius: 12px;
                    padding: 15px;
                    font-size: 12px;
                    color: #666;
                    text-align: left;
                    margin-top: 20px;
                ">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>版本:</span>
                        <span style="font-weight: bold;">v${IDCardAuth.config.version}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>双重验证:</span>
                        <span style="color: #ff6b6b; font-weight: bold;">已启用</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>授权到期:</span>
                        <span>${IDCardAuth.config.expireDate}</span>
                    </div>
                    <div style="font-size: 11px; color: #999; margin-top: 10px; text-align: center;">
                        © 2026 晚风叙信 | 全员答题(模拟考试、手机考试) v3.7（适配30题+排名查询）
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(authDiv);
        
        setTimeout(() => {
            document.getElementById('idcard-input').value = "";
            document.getElementById('idcard-input').focus();
        }, 300);
        
        const activateBtn = document.getElementById('activate-btn');
        activateBtn.addEventListener('click', function() {
            const idcardInput = document.getElementById('idcard-input');
            const idCard = idcardInput.value.trim();
            const errorDiv = document.getElementById('license-error');
            
            if (!idCard) {
                showError(errorDiv, "请输入身份证号");
                return;
            }
            
            this.innerHTML = '正在双重验证...';
            this.disabled = true;
            
            setTimeout(() => {
                const result = IDCardAuth.activateIDCard(idCard);
                if (result.success) {
                    authDiv.style.opacity = '0';
                    authDiv.style.transition = 'opacity 0.5s ease';
                    setTimeout(() => {
                        if (authDiv.parentNode) {
                            authDiv.parentNode.removeChild(authDiv);
                        }
                        setTimeout(() => {
                            location.reload();
                        }, 1000);
                    }, 500);
                } else {
                    this.innerHTML = '开始双重验证';
                    this.disabled = false;
                    if (result.needsPageVerification) {
                        showError(errorDiv, result.message);
                        idcardInput.style.borderColor = '#ff4757';
                        const pageIdInfo = document.getElementById('page-id-info');
                        const pageIdValue = document.getElementById('page-id-value');
                        const pageIDCard = IDCardAuth.getPageIDCard();
                        if (pageIDCard) {
                            pageIdValue.textContent = IDCardAuth.maskIDCard(pageIDCard);
                            pageIdInfo.style.display = 'block';
                        }
                    } else {
                        showError(errorDiv, result.message);
                        idcardInput.style.borderColor = '#ff4757';
                    }
                    
                    const lockStatus = IDCardAuth.isLocked();
                    if (lockStatus.locked) {
                        setTimeout(() => {
                            authDiv.remove();
                            showLockedMessage(lockStatus.remainingHours);
                        }, 1500);
                    }
                }
            }, 800);
        });
        
        document.getElementById('detect-page-id').addEventListener('click', function(e) {
            e.preventDefault();
            detectPageIDCard();
        });
        
        document.getElementById('idcard-input').addEventListener('input', function(e) {
            const value = e.target.value.replace(/[^0-9Xx]/g, '');
            e.target.value = value.toUpperCase();
            e.target.style.borderColor = '#e1e5e9';
            document.getElementById('license-error').style.display = 'none';
        });
        
        document.getElementById('idcard-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('activate-btn').click();
            }
        });
        
        function detectPageIDCard() {
            const pageIDCard = IDCardAuth.getPageIDCard();
            const pageIdInfo = document.getElementById('page-id-info');
            const pageIdValue = document.getElementById('page-id-value');
            if (pageIDCard) {
                pageIdValue.textContent = IDCardAuth.maskIDCard(pageIDCard);
                pageIdInfo.style.display = 'block';
                document.getElementById('idcard-input').value = pageIDCard;
                document.getElementById('idcard-input').focus();
                const errorDiv = document.getElementById('license-error');
                showError(errorDiv, "✅ 已自动检测并填充页面身份证号", "success");
            } else {
                showError(document.getElementById('license-error'), 
                    "❌ 未检测到页面身份证号，请确保您已登录并进入考试页面");
            }
        }
        
        function showError(element, message, type = "error") {
            element.textContent = message;
            element.style.display = 'block';
            if (type === "success") {
                element.style.color = '#00b09b';
            } else {
                element.style.color = '#ff4757';
            }
        }
    }
})();
