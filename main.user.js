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
        statusDiv: null
    };
    window._autoSubmitEnabled = false; // 自动交卷开关
    
    // ==================== 身份证授权系统（双重验证版） ====================
    const IDCardAuth = {
        encryptedIDs: [
            "fXVveWdneWZydGlu"  
        ],
        config: {
            expireDate: "2026-12-31",
            version: "3.6",
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
    // ==================== 主程序 ====================
    console.log('🚀 启动全员答题系统 v3.6（适配30题+GitHub更新）');
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
                        © 2026 晚风叙信 | 全员答题(模拟考试、手机考试) v3.6（适配30题+GitHub更新）
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
    // ==================== 主功能（适配30题） ====================
    function initializeMainProgram() {
        console.log('🎯 初始化答题功能（适配30题+GitHub更新）...');
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
                .exam-helper-btn-auto-submit { /* 自动交卷按钮样式 */
                    background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%);
                    color: white;
                    right: 20px;
                    bottom: 50px;
                }
                .exam-helper-btn-auto-submit.active { /* 开启状态样式 */
                    background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%);
                }
                .exam-helper-btn-info {
                    background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%);
                    color: white;
                    right: 20px;
                    bottom: 250px;
                    opacity: 0.5;
                    font-size: 10px;
                    padding: 5px 10px;
                }
                .exam-helper-btn-info:hover {
                    opacity: 1;
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
                'exam-helper-update' // 清理更新按钮
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
                statusDiv: null
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
            badge.title = statusInfo.isVideoPage ? '起飞模式' : '双重验证通过（30题适配+GitHub更新）';
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
                <div style="margin-bottom: 5px; font-weight: bold; font-size: 11px;">双重验证信息（30题适配+GitHub更新）</div>
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
                    点击任意处关闭 | 支持GitHub在线更新
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
                'exam-helper-stop'
            ];
            if (elements.some(id => document.getElementById(id))) {
                console.log('⚠️ 控制面板元素已存在，跳过创建');
                return;
            }
            const statusDiv = document.createElement('div');
            statusDiv.id = 'exam-helper-status';
            statusDiv.className = 'exam-helper-status';
            document.body.appendChild(statusDiv);
            window._examHelperElements.statusDiv = statusDiv;
            const startBtn = document.createElement('button');
            startBtn.id = 'exam-helper-start';
            startBtn.className = 'exam-helper-btn exam-helper-btn-start';
            startBtn.innerHTML = '▶开始答题(30题)';
            startBtn.title = '开始自动答题 (Ctrl+Alt+S)';
            document.body.appendChild(startBtn);
            window._examHelperElements.startBtn = startBtn;
            const stopBtn = document.createElement('button');
            stopBtn.id = 'exam-helper-stop';
            stopBtn.className = 'exam-helper-btn exam-helper-btn-stop';
            stopBtn.innerHTML = '停止答题';
            stopBtn.title = '停止自动答题 (Ctrl+Alt+P)';
            stopBtn.style.display = 'none';
            document.body.appendChild(stopBtn);
            window._examHelperElements.stopBtn = stopBtn;
            
            // 创建自动交卷按钮
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
        // 获取当前显示的题目编号（适配30题页面结构）
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
        // 跳转到指定题目（适配30题页面跳转逻辑）
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
        // 获取标准答案（保持原逻辑，适配30题答案存储结构）
        function getCorrectAnswer(questionId) {
            const answerInput = document.getElementById(`${questionId}bzda`);
            return answerInput ? answerInput.value.trim() : null;
        }
        // 答题函数（保持原逻辑，适配30题选项结构）
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
        // 翻到下一题（适配30题页面下一题函数）
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
        // 自动交卷+结束考试 完整流程（核心补充）
        function autoSubmitAndFinishExam() {
            console.log('📤 执行自动交卷+结束考试流程...');
            showStatus('📤 正在交卷，请稍候...', 3000);
            
            try {
                // 第一步：触发交卷（适配网页逻辑）
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
                        
                        // 第三步：交卷成功后，自动点击"结束考试"（适配网页 btnClose 按钮和 SleepClose 函数）
                        setTimeout(() => {
                            // 方式1：直接调用结束考试函数
                            if (typeof window.SleepClose === 'function') {
                                console.log('✅ 调用结束考试函数 SleepClose()');
                                window.SleepClose();
                                showStatus('🎉 考试已结束！', 5000);
                                return;
                            }
                            
                            // 方式2：点击结束考试按钮（ID为btnClose）
                            const finishBtn = document.getElementById('btnClose');
                            if (finishBtn) {
                                console.log('✅ 点击结束考试按钮');
                                finishBtn.click();
                                showStatus('🎉 考试已结束！', 5000);
                                return;
                            }
                            
                            // 方式3：适配其他可能的结束按钮
                            const otherFinishBtn = document.querySelector('.btn-danger[onclick*="SleepClose"], [data-dismiss="modal"].btn-danger');
                            if (otherFinishBtn) {
                                console.log('✅ 点击其他结束考试按钮');
                                otherFinishBtn.click();
                                showStatus('🎉 考试已结束！', 5000);
                                return;
                            }
                            
                            // 所有方式失败时提示
                            showStatus('✅ 交卷成功，请手动点击"结束考试"', 5000);
                        }, 1500); // 交卷确认后延迟1.5秒执行结束考试
                    } else {
                        // 无确认弹窗，直接执行结束考试
                        setTimeout(() => {
                            if (typeof window.SleepClose === 'function') {
                                window.SleepClose();
                                showStatus('🎉 交卷并结束考试成功！', 5000);
                            } else {
                                showStatus('✅ 交卷成功，请手动结束考试', 5000);
                            }
                        }, 1000);
                    }
                }, 1000); // 交卷后延迟1秒检测确认弹窗
            } catch (e) {
                console.error('❌ 交卷流程出错:', e);
                showStatus('❌ 交卷失败，请手动操作', 5000);
            }
        }
        // 自动答题主函数（调用完整交卷流程）
        function startAutoAnswer() {
            const authStatus = IDCardAuth.checkAuthorization();
            if (authStatus.status !== "authorized") {
                showStatus('❌ 验证失效，请重新登录');
                return;
            }
            let currentQuestion = getCurrentQuestionNumber();
            const totalQuestions = 30;
            const interval = 100;  // 修改答题速度🉑
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
        // 停止答题（保持原逻辑）
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
        // 检查已答题目（适配30题）
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
        // 重新验证身份（保持原逻辑）
        function reVerifyIdentity() {
            showStatus('🔍 验证身份...', 1500);
            setTimeout(() => {
                const result = IDCardAuth.verifyPageIDCard();
                if (result.success) {
                    showStatus('✅ 验证成功', 2000);
                } else {
                    showStatus(`❌ 验证失败`, 3000);
                }
            }, 1000);
        }
        // ==================== GitHub 在线更新功能（优化版） ====================
        function initUpdateCheck() {
            const GITHUB_UPDATE_CONFIG = {
                updateJsonUrl: "https://raw.githubusercontent.com/你的GitHub用户名/exam-helper-auto-update/main/update.json",
                currentVersion: "3.6",  // 必须与脚本头部 @version 一致
                cacheExpire: 3600000  // 缓存1小时，避免频繁请求GitHub
            };

            // 版本对比工具（支持 x.y.z 格式，兼容单/多位数版本）
            function compareVersions(v1, v2) {
                const arr1 = v1.split(".").map(Number);
                const arr2 = v2.split(".").map(Number);
                const maxLen = Math.max(arr1.length, arr2.length);
                for (let i = 0; i < maxLen; i++) {
                    const num1 = arr1[i] || 0;
                    const num2 = arr2[i] || 0;
                    if (num1 !== num2) return num1 - num2;
                }
                return 0;
            }

            // 检测更新（带缓存逻辑）
            async function checkForUpdate(manualCheck = false) {
                // 优先读取缓存，避免重复请求
                const cacheKey = "examHelperUpdateCache";
                const cachedData = GM_getValue(cacheKey, null);
                const now = Date.now();

                // 缓存未过期且非手动检查，直接使用缓存
                if (cachedData && now - cachedData.timestamp < GITHUB_UPDATE_CONFIG.cacheExpire && !manualCheck) {
                    handleUpdateInfo(cachedData.updateInfo);
                    return;
                }

                // 显示加载状态
                if (manualCheck) showStatus("🔍 正在检查更新...", 2000);

                try {
                    const response = await fetch(GITHUB_UPDATE_CONFIG.updateJsonUrl, {
                        method: "GET",
                        cache: "no-cache",
                        headers: { "Accept": "application/json" }
                    });

                    if (!response.ok) throw new Error(`HTTP错误：${response.status}`);
                    const updateInfo = await response.json();

                    // 缓存更新信息
                    GM_setValue(cacheKey, {
                        timestamp: now,
                        updateInfo: updateInfo
                    });

                    handleUpdateInfo(updateInfo, manualCheck);
                } catch (error) {
                    console.warn("更新检测失败：", error);
                    if (manualCheck) showStatus("❌ 更新检测失败，请检查网络", 3000);
                }
            }

            // 处理更新信息（核心逻辑）
            function handleUpdateInfo(updateInfo, manualCheck = false) {
                const versionCompare = compareVersions(GITHUB_UPDATE_CONFIG.currentVersion, updateInfo.latestVersion);

                // 有新版本
                if (versionCompare < 0) {
                    showUpdateAlert(updateInfo);
                } 
                // 当前是最新版本
                else if (manualCheck) {
                    showStatus("✅ 当前已是最新版本 v" + GITHUB_UPDATE_CONFIG.currentVersion, 2000);
                }
            }

            // 显示更新提示弹窗（支持多版本日志+强制更新）
            function showUpdateAlert(updateInfo) {
                const existingAlert = document.getElementById("exam-helper-update-alert");
                if (existingAlert) existingAlert.remove();

                // 构建更新日志HTML
                let changelogHtml = "";
                updateInfo.changelog.forEach(log => {
                    changelogHtml += `
                        <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #f0f0f0;">
                            <div style="font-size: 16px; font-weight: bold; color: #667eea; margin-bottom: 8px;">
                                v${log.version}（${log.date}）
                            </div>
                            <ul style="text-align: left; margin: 0; padding-left: 20px; color: #666; font-size: 13px; line-height: 1.6;">
                                ${log.content.map(item => `<li>${item}</li>`).join("")}
                            </ul>
                        </div>
                    `;
                });

                // 弹窗样式
                const alertDiv = document.createElement("div");
                alertDiv.id = "exam-helper-update-alert";
                alertDiv.style.cssText = `
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: white; padding: 25px; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.2);
                    z-index: 10000; width: 90%; max-width: 450px; text-align: center;
                    font-family: 'Microsoft YaHei', sans-serif;
                `;

                // 强制更新 vs 可选更新
                const isForceUpdate = updateInfo.forceUpdate === true;
                const buttonHtml = isForceUpdate ? `
                    <button id="update-now-btn" style="
                        background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%);
                        color: white; border: none; padding: 12px 40px; border-radius: 25px;
                        font-size: 16px; cursor: pointer; width: 100%;
                    ">必须更新才能使用</button>
                ` : `
                    <button id="update-now-btn" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white; border: none; padding: 10px 30px; border-radius: 20px;
                        font-size: 16px; cursor: pointer; margin-right: 10px;
                    ">立即更新</button>
                    <button id="skip-update-btn" style="
                        background: #f5f5f5; color: #666; border: none; padding: 10px 20px;
                        border-radius: 20px; font-size: 14px; cursor: pointer;
                    ">稍后再说</button>
                `;

                alertDiv.innerHTML = `
                    <div style="font-size: 22px; font-weight: bold; margin-bottom: 15px; color: #333;">
                        📢 发现新版本 v${updateInfo.latestVersion}
                    </div>
                    <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
                        ${changelogHtml}
                    </div>
                    <div style="display: flex; justify-content: center; gap: 10px;">
                        ${buttonHtml}
                    </div>
                    ${isForceUpdate ? '<div style="margin-top: 10px; font-size: 12px; color: #ff4757;">此更新包含关键修复，必须升级才能继续使用</div>' : ''}
                `;

                document.body.appendChild(alertDiv);

                // 立即更新：跳转至Raw链接触发Tampermonkey更新
                document.getElementById("update-now-btn").addEventListener("click", () => {
                    window.open(updateInfo.updateURL || updateInfo.downloadURL, "_blank");
                    if (!isForceUpdate) alertDiv.remove();
                });

                // 稍后再说：关闭弹窗（强制更新时隐藏该按钮）
                if (!isForceUpdate) {
                    document.getElementById("skip-update-btn").addEventListener("click", () => {
                        alertDiv.remove();
                        // 记录跳过时间，24小时内不再提示
                        GM_setValue("examHelperSkipUpdate", {
                            version: updateInfo.latestVersion,
                            timestamp: Date.now()
                        });
                    });
                }
            }

            // 初始化更新检测
            function init() {
                // 检查是否跳过了当前版本（24小时内）
                const skipInfo = GM_getValue("examHelperSkipUpdate", null);
                const now = Date.now();
                let updateInfo = null;
                const needCheck = !skipInfo || 
                                  (updateInfo && skipInfo.version !== updateInfo.latestVersion) || 
                                  now - (skipInfo.timestamp || 0) > 86400000;

                // 自动检测更新（3秒后执行，避免阻塞主程序）
                if (needCheck) {
                    setTimeout(() => checkForUpdate(), 3000);
                }

                // 新增“检查更新”按钮（放在控制面板顶部）
                const updateBtn = document.createElement("button");
                updateBtn.id = "exam-helper-update";
                updateBtn.className = "exam-helper-btn";
                updateBtn.style.cssText = `
                    right: 20px; bottom: 300px; 
                    background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%); 
                    color: white; padding: 8px 12px; border-radius: 20px; font-size: 12px;
                `;
                updateBtn.innerHTML = "🔍 检查更新";
                updateBtn.title = "手动检查GitHub最新版本";
                document.body.appendChild(updateBtn);

                // 绑定手动检查事件
                updateBtn.addEventListener("click", () => checkForUpdate(true));
            }

            // 执行初始化
            init();
        }

        // 主程序初始化（添加自动交卷快捷键）
        function init() {
            console.log('🎯 初始化答题助手主程序（30题适配+GitHub更新）');
            const isVideoPage = IDCardAuth.isVideoPage();
            if (isVideoPage) {
                console.log('🔥 检测到视频题页面，启用特殊模式');
                document.body.classList.add('exam-helper-video-mode');
            }
            createAuthBadge();
            createControlPanel();
            const startBtn = document.getElementById('exam-helper-start');
            const stopBtn = document.getElementById('exam-helper-stop');
            const checkBtn = document.getElementById('exam-helper-check');
            const infoBtn = document.getElementById('exam-helper-info');
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
            showStatus('✅ 助手已就绪(30题+GitHub更新)', 2000);
            // 快捷键配置
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
                    // 自动交卷快捷键（Ctrl+Alt+A）
                    if (e.ctrlKey && e.altKey && e.key === 'a') {
                        document.getElementById('exam-helper-auto-submit').click();
                    }
                });
                document._examHelperKeyListener = true;
            }
            console.log('🎉 答题助手已完全加载（30题适配+GitHub更新）');
            
            // 调用GitHub更新功能初始化
            initUpdateCheck();
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(init, 1500);
            });
        } else {
            setTimeout(init, 1500);
        }
    }
    // 显示页面验证要求（保持原逻辑）
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
                <div style="margin-bottom
