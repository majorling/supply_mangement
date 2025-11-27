/**
 * 项目打包与分发脚本
 * 
 * 使用前请确保安装以下依赖：
 * npm install fs-extra archiver
 * 
 * 使用方法：
 * node package-demo.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const fsExtra = require('fs-extra');
const archiver = require('archiver');

const execAsync = promisify(exec);

// 定义路径
const sourceDir = process.cwd();
const parentDir = path.dirname(sourceDir);
const outputDir = path.join(parentDir, 'slm-static-dist');
const zipPath = path.join(parentDir, 'slm-static-dist.zip');

// 主函数
async function main() {
    try {
        console.log('🚀 开始执行项目打包...');
        console.log(`📁 源目录: ${sourceDir}`);
        console.log(`📁 输出目录: ${outputDir}`);
        
        // 清理可能存在的旧文件
        await cleanupOldFiles();
        
        // 创建输出目录
        await fsExtra.ensureDir(outputDir);
        console.log('✅ 输出目录已创建');
        
        // 检测项目类型
        const isFrameworkProject = await detectProjectType();
        
        if (isFrameworkProject) {
            console.log('🔍 检测到框架项目，开始执行框架项目打包流程...');
            await packageFrameworkProject();
        } else {
            console.log('🔍 检测到纯静态项目，开始执行静态文件复制流程...');
            await packageStaticProject();
        }
        
        // 创建使用说明文件
        await createReadmeFile();
        
        // 压缩文件
        await createZipFile();
        
        // 清理临时文件夹
        await fsExtra.remove(outputDir);
        console.log('✅ 临时文件夹已清理');
        
        console.log(`\n✅ 打包成功！产物已生成于：${zipPath}`);
        
    } catch (error) {
        console.error('❌ 打包失败:', error.message);
        process.exit(1);
    }
}

// 清理旧文件
async function cleanupOldFiles() {
    try {
        if (await fsExtra.pathExists(outputDir)) {
            await fsExtra.remove(outputDir);
            console.log('🧹 已清理旧的输出目录');
        }
        if (await fsExtra.pathExists(zipPath)) {
            await fsExtra.remove(zipPath);
            console.log('🧹 已清理旧的ZIP文件');
        }
    } catch (error) {
        console.warn('⚠️ 清理旧文件时出现警告:', error.message);
    }
}

// 检测项目类型
async function detectProjectType() {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    const srcDirPath = path.join(sourceDir, 'src');
    
    const hasPackageJson = await fsExtra.pathExists(packageJsonPath);
    const hasSrcDir = await fsExtra.pathExists(srcDirPath);
    
    return hasPackageJson && hasSrcDir;
}

// 打包框架项目
async function packageFrameworkProject() {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    let originalPackageJson = null;
    let packageJsonModified = false;
    
    try {
        // 读取并备份 package.json
        console.log('📝 正在读取 package.json...');
        const packageJsonContent = await fsExtra.readFile(packageJsonPath, 'utf8');
        originalPackageJson = packageJsonContent;
        
        // 修改 homepage 字段
        const packageJson = JSON.parse(packageJsonContent);
        const originalHomepage = packageJson.homepage;
        packageJson.homepage = './';
        
        console.log(`📝 正在修改 homepage 字段: "${originalHomepage || '(未设置)'}" -> "./"`)
        
        // 写回修改后的 package.json
        await fsExtra.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
        packageJsonModified = true;
        
        // 执行打包命令
        console.log('📦 正在执行 npm run build...');
        console.log('⏳ 这可能需要一些时间，请耐心等待...');
        
        try {
            const { stdout, stderr } = await execAsync('npm run build', { cwd: sourceDir });
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
        } catch (buildError) {
            console.error('❌ 构建失败:', buildError.message);
            throw buildError;
        }
        
        console.log('✅ 构建完成');
        
        // 查找构建产物目录
        const possibleBuildDirs = ['dist', 'build'];
        let buildDir = null;
        
        for (const dir of possibleBuildDirs) {
            const dirPath = path.join(sourceDir, dir);
            if (await fsExtra.pathExists(dirPath)) {
                buildDir = dirPath;
                break;
            }
        }
        
        if (!buildDir) {
            throw new Error('未找到构建产物目录 (dist 或 build)');
        }
        
        console.log(`📁 找到构建产物目录: ${path.basename(buildDir)}`);
        
        // 复制构建产物到输出目录
        console.log('📋 正在复制构建产物...');
        await fsExtra.copy(buildDir, outputDir);
        console.log('✅ 构建产物已复制到输出目录');
        
    } finally {
        // 恢复原始的 package.json
        if (packageJsonModified && originalPackageJson) {
            console.log('🔄 正在恢复原始的 package.json...');
            await fsExtra.writeFile(packageJsonPath, originalPackageJson);
            console.log('✅ package.json 已恢复');
        }
    }
}

// 打包纯静态项目
async function packageStaticProject() {
    console.log('📋 正在复制文件...');
    
    const files = await fsExtra.readdir(sourceDir);
    
    for (const file of files) {
        // 跳过脚本自身
        if (file === 'package-demo.js') {
            continue;
        }
        
        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(outputDir, file);
        
        await fsExtra.copy(sourcePath, destPath);
        console.log(`  ✓ 已复制: ${file}`);
    }
    
    console.log('✅ 所有文件已复制到输出目录');
}

// 创建使用说明文件
async function createReadmeFile() {
    console.log('📝 正在创建使用说明文件...');
    
    const readmeContent = `1. 解压本ZIP包到任意文件夹。
2. 使用Chrome、Firefox或Edge浏览器，双击打开解压后的 index.html 文件。
3. 若部分功能（如图表、导出）无法使用，请确保电脑已连接互联网。`;
    
    const readmePath = path.join(outputDir, '使用说明.txt');
    await fsExtra.writeFile(readmePath, readmeContent, 'utf8');
    
    console.log('✅ 使用说明文件已创建');
}

// 创建ZIP文件
async function createZipFile() {
    console.log('🗜️ 正在压缩文件...');
    
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // 最高压缩级别
        });
        
        output.on('close', () => {
            const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
            console.log(`✅ ZIP文件已创建，大小: ${sizeInMB} MB`);
            resolve();
        });
        
        archive.on('error', (err) => {
            reject(err);
        });
        
        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn('⚠️ 压缩警告:', err);
            } else {
                reject(err);
            }
        });
        
        archive.pipe(output);
        
        // 添加整个输出目录到压缩包
        archive.directory(outputDir, false);
        
        archive.finalize();
    });
}

// 执行主函数
main().catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
});
