/**
 * @file img2img.ts
 * @description img2img api
 * 
 * 图生图,调用jimeng_i2i_v30(图生图3.0智能参考)
 * API文档:https://www.volcengine.com/docs/85621/1747301
 */

// @/表示配合tsconfig.json中定义的@/*路径别名扫描runtime包
import { Args } from '@/runtime'; // 这里的runtime是coze平台提供的运行时环境
import { Input, Output } from "@/typings/img2img/img2img"; // 这里的typings/img2img/img2img是coze平台根据输入输出定义自动生成的类型定义文件
import * as crypto from 'crypto';
import { URL, URLSearchParams } from 'url';
import * as util from "util";

/**
 * 不参与加签过程的 header key
 */
const HEADER_KEYS_TO_IGNORE = new Set([
    "authorization",
    // "content-type",
    "content-length",
    "user-agent",
    "presigned-expires",
    "expect",
]);

const API_HOST = 'visual.volcengineapi.com'
const API_REGION = 'cn-beijing'
const API_SERVICE = 'cv'

// 1. 请求即梦AI调用图生图接口生成图生图任务
// 2. 调用任务查询接口, 等待任务结束, 返回图片URL

interface SignParams {
    host: string;
    headers: { [key: string]: string };
    method: string;
    pathName: string;
    query: { [key: string]: string };
    accessKeyId: string;
    secretAccessKey: string;
    needSignHeaderKeys: string[];
    serviceName: string;
    region: string;
    bodySha: string;
}
function sign(params: SignParams) {
    const {
        host,
        headers = {},
        query = {},
        region = '',
        serviceName = '',
        method = '',
        pathName = '/',
        accessKeyId = '',
        secretAccessKey = '',
        needSignHeaderKeys = [],
        bodySha,
    } = params;
    const datetime = headers["X-Date"];
    const date = datetime.substring(0, 8); // YYYYMMDD
    // 创建正规化请求
    // const [signedHeaders, canonicalHeaders] = getSignHeaders(headers, needSignHeaderKeys);
    const signedHeaders = 'content-type;host;x-content-sha256;x-date'
    const canonicalHeaders = 'content-type:' + headers['Content-Type'] + '\n' + 'host:' + params.host +
        '\n' + 'x-content-sha256:' + params.bodySha +
        '\n' + 'x-date:' + datetime + '\n'
    console.log("[signedHeaders] " + signedHeaders)
    console.log("[canonicalHeaders]" + canonicalHeaders)

    const canonicalRequest = [
        method.toUpperCase(),
        pathName,
        queryParamsToString(query) || '',
        `${canonicalHeaders}`,
        signedHeaders,
        bodySha || hash(''),
    ].join('\n');
    console.log("[canonicalRequest] " + canonicalRequest)

    const credentialScope = [date, region, serviceName, "request"].join('/');
    console.log("[credentialScope] " + credentialScope)

    // 创建签名字符串
    const stringToSign = ["HMAC-SHA256", datetime, credentialScope, hash(canonicalRequest)].join('\n');
    console.log("[stringToSign] " + stringToSign)
    // 计算签名
    const kDate = hmac(secretAccessKey, date);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, serviceName);
    const kSigning = hmac(kService, "request");
    console.log("[kSigning] " + kSigning)

    const signature = hmac(kSigning, stringToSign).toString('hex');
    // throw new Error("\n"+
    //   "canonicalRequest:"+canonicalRequest+"\n"+
    //   "credentialScope:"+credentialScope+"\n"+
    //   "stringToSign:"+stringToSign+"\n"+
    //   "kDate:"+kDate.toString('hex')+"\n"+
    //   "kRegion:"+kRegion.toString('hex')+"\n"+
    //   "kService:"+kService.toString('hex')+"\n"+
    //   "kSigning:"+kSigning.toString('hex')+"\n"+
    //   "signature:"+signature
    // );

    return [
        "HMAC-SHA256",
        `Credential=${accessKeyId}/${credentialScope},`,
        `SignedHeaders=${signedHeaders},`,
        `Signature=${signature}`,
    ].join(' ');
}

function hmac(secret: any, s: string) {
    return crypto.createHmac('sha256', secret).update(s, 'utf8').digest();
}

function hash(s: string) {
    return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function queryParamsToString(params: any) {
    return Object.keys(params)
        .sort()
        .map((key) => {
            const val = params[key];
            if (typeof val === 'undefined' || val === null) {
                return undefined;
            }
            const escapedKey = uriEscape(key);
            if (!escapedKey) {
                return undefined;
            }
            if (Array.isArray(val)) {
                return `${escapedKey}=${val.map(uriEscape).sort().join(`&${escapedKey}=`)}`;
            }
            return `${escapedKey}=${uriEscape(val)}`;
        })
        .filter((v) => v)
        .join('&');
}

function getSignHeaders(originHeaders: { [key: string]: any }, needSignHeaders: string[]) {
    function trimHeaderValue(header: any) {
        return header.toString?.().trim().replace(/\s+/g, ' ') ?? '';
    }

    let h = Object.keys(originHeaders);
    // 根据 needSignHeaders 过滤
    if (Array.isArray(needSignHeaders)) {
        const needSignSet = new Set([...needSignHeaders, 'x-date', 'host'].map((k) => k.toLowerCase()));
        h = h.filter((k) => needSignSet.has(k.toLowerCase()));
    }
    // 根据 ignore headers 过滤
    h = h.filter((k) => !HEADER_KEYS_TO_IGNORE.has(k.toLowerCase()));
    const signedHeaderKeys = h
        .slice()
        .map((k) => k.toLowerCase())
        .sort()
        .join(';');
    const canonicalHeaders = h
        .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
        .map((k) => `${k.toLowerCase()}:${trimHeaderValue(originHeaders[k])}`)
        .join('\n');
    return [signedHeaderKeys, canonicalHeaders];
}

function uriEscape(str: string) {
    try {
        return encodeURIComponent(str)
            .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
            .replace(/[*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
    } catch (e) {
        return '';
    }
}

function getDateTimeNow() {
    const now = new Date();
    return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

// 获取 body sha256
function getBodySha(body: string | URLSearchParams): string {
    const hash = crypto.createHash('sha256');
    if (typeof body === 'string') {
        hash.update(body);
    } else if (body instanceof URLSearchParams) {
        hash.update(body.toString());
    }
    return hash.digest('hex');
}

// 执行请求的主函数
async function sendRequest(
    path: string,
    method: string,
    queries: object,
    body: string,
    access_key_id: string,
    secret_access_key: string
): Promise<{ status: number, data: any }> {
    try {
        // 1. 构建请求
        const queryParams = queryParamsToString(queries)
        const requestAddr = `https://${API_HOST}${path}?${queryParams}`;

        // 2. 构建签名材料
        const signParams: SignParams = {
            host: API_HOST,
            headers: {
                // x-date header 是必传的
                ["X-Date"]: getDateTimeNow(),
                ["Content-Type"]: "application/json",
                ["X-Content-Sha256"]: getBodySha(body),
                // ["X-Date"]: "20250902T110048Z",
            },
            method: method,
            pathName: path || '/',
            query: { ...queries } as { [key: string]: string },
            accessKeyId: access_key_id,
            secretAccessKey: secret_access_key,
            needSignHeaderKeys: ["Content-Type", "Host", "X-Content-Sha256", "X-Date"],
            serviceName: API_SERVICE,
            region: API_REGION,
            bodySha: getBodySha(body), // POST/PUT/PATCH 请求时，需要计算 body sha256 值
        };
        // 正规化 query object， 防止串化后出现 query 值为 undefined 情况
        for (const [key, val] of Object.entries(signParams.query)) {
            if (val === undefined || val === null) {
                signParams.query[key] = '';
            }
        }

        // 构建body
        // signParams.bodySha = getBodySha(body);

        const authorization = sign(signParams);
        // throw new Error(signParams.headers['X-Date']+"\n"+"bodySha:" + signParams.bodySha + "\n" + "authorization:"+authorization)

        // 3. 构建请求头
        const headers = {
            ...signParams.headers,
            'Authorization': authorization,
        };

        console.log("================")
        console.log(`request url: ${requestAddr}`)
        console.log(`request method: ${method}`)
        console.log(`request headers: ${JSON.stringify(headers)}`)
        console.log(`request body: ${body}`)
        console.log("================")
        // 4. 发送请求
        const response = await fetch(requestAddr, {
            method: method,
            headers: headers,
            // body: method === 'POST' ? body : undefined
            body: body
        });

        // 5. 处理响应
        const responseData = await response.json();

        return {
            status: response.status,
            data: responseData
        };

    } catch (error: any) {
        throw new Error(`Request failed: ${error.message}`);
    }
}

// 将字符串转换为 Unicode 转义序列格式
// function convertToUnicodeEscape(str: string): string {
//     return str.replace(/./g, (char) => {
//         const code = char.charCodeAt(0);
//         return "\u" + code.toString(16).padStart(4, "0");
//     });
// }

// 定义请求即梦AI图生图接口的函数
async function generateImageTask(ak: string, sk: string, imgUrls: string[], prompt: string): Promise<string> {

    const action = "CVSync2AsyncSubmitTask"
    const version = "2022-08-31"
    const req_key = "jimeng_i2i_v30"

    const queryParams = {
        Action: action,
        Version: version
    };

    const body = JSON.stringify({
        req_key: req_key,
        image_urls: imgUrls,
        prompt: prompt
    });

    console.log("generate task body, ", body)

    const response = await sendRequest("", "POST", queryParams,
        body,
        ak,
        sk
    );

    // throw new Error(JSON.stringify(response))
    // throw new Error(JSON.stringify(response.data.data))
    // 打印response
    console.log("generate task response, ", response)

    if (response.status !== 200) {
        console.error("generate task error, ", response)
        throw new Error(`Failed to generate image, HTTP status code: ${response.status}`);
    }

    if (response.data.status !== 10000) {
        console.error("generate task error, ", response)
        throw new Error('Failed to get task ID from image generation request');
    }

    if (!response.data.data || !response.data.data.task_id) {
        console.error("generate task error, ", response)
        throw new Error('Invalid response format from image generation request');
    }

    if (!response.data.data.task_id) {
        throw new Error('Failed to get task ID from image generation request');
    }

    return response.data.data.task_id;
}

// 定义查询任务状态的函数
async function queryTaskStatus(ak: string, sk: string, taskId: string): Promise<{ status: string; imgUrls?: string[] }> {

    const action = "CVSync2AsyncGetResult"
    const version = "2022-08-31"
    const req_key = "jimeng_i2i_v30"

    const queryParams = {
        Action: action,
        Version: version
    };

    const body = JSON.stringify({
        req_key: req_key,
        task_id: taskId,
        req_json: JSON.stringify({
            return_url: true
        })
    });

    const response = await sendRequest("", "POST", queryParams,
        body,
        ak,
        sk
    );

    console.log("query task response, ", util.inspect(response, { depth: null }))

    if (response.status !== 200) {
        throw new Error(`Failed to query task status, HTTP status code: ${response.status}`);
    }

    if (!response.data.data || !response.data.data.status) {
        throw new Error('Invalid response format when querying task status');
    }

    return {
        status: response.data.data.status,
        imgUrls: response.data.data.image_urls,
    };
}

// 定义等待任务完成的函数
const generatingStatuses = ["in_queue", "generating"]
const faildStatuses = ["not_found", "expired"]

async function waitForTaskCompletion(taskId: string, ak: string, sk: string): Promise<{ status: string; imgUrls: string[] }> {
    const checkInterval = 2000; // 每3秒检查一次任务状态
    let maxRetries = 90; // 最多重试90次

    var taskStatus = ""
    while (maxRetries > 0) {

        const { status, imgUrls } = await queryTaskStatus(taskId, ak, sk);
        console.log("task status is " + status)
        taskStatus = status

        if (faildStatuses.includes(status)) {
            throw new Error('Task failed!status is ' + status);
        } else if (status === 'done' && imgUrls) {
            return {
                status: status,
                imgUrls: imgUrls
            };
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        maxRetries--;
    }

    throw new Error('Task did not complete within the expected time!task status is ' + taskStatus);
}

/**
  * Each file needs to export a function named `handler`. This function is the entrance to the Tool.
  * @param {Object} args.input - input parameters, you can get test input value by input.xxx.
  * @param {Object} args.logger - logger instance used to print logs, injected by runtime
  * @returns {*} The return data of the function, which should match the declared output parameters.
  * 
  * Remember to fill in input/output in Metadata, it helps LLM to recognize and use tool.
  */
export async function handler({ input, logger }: Args<Input>): Promise<Output> {

    try {
        // 打印日志
        logger.info('Starting image generation task...');
        const taskId = await generateImageTask(input.ak, input.sk, input.img_urls, input.prompt);
        logger.info(`Image generation task created with ID: ${taskId}`);

        const { status, imgUrls } = await waitForTaskCompletion(input.ak, input.sk, taskId);
        logger.info(`Image generation completed. Image URLs: ${imgUrls}`);

        var message = "Task execute succefully!"
        if (status != "done") {
            message = "Task execute failed!Task status is " + status
        }
        return {
            status: status,
            img_urls: imgUrls,
            message: message,
        };
    } catch (error) {
        logger.error(`Image generation failed: ${error instanceof Error ? error.message : String(error)}`);
        return {
            status: "failed",
            img_urls: [],
            message: `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

