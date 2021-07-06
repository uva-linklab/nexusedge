const si = require('systeminformation');
const osUtils = require('os-utils');
const _ = require('lodash');

function getFreeCpuPercent() {
    return new Promise(resolve => {
        osUtils.cpuFree(cpuFreePercent => {
            resolve(cpuFreePercent)
        });
    })
}

async function getStats() {
    const stats = {};

    const cpu = await si.cpu();
    const mem = await si.mem();
    const os = await si.osInfo();
    const gpu = await si.graphics();
    const fs = await si.fsSize();

    const cpuFields = ['manufacturer', 'vendor', 'family', 'cores', 'physicalCores', 'processors', 'speedMax'];
    const memFields = ['total', 'free'];
    const osFields = ['platform', 'distro', 'release', 'codename', 'kernel', 'arch'];
    const gpuFields = ['vram', 'vendor', 'model'];
    const fsFields = ['used', 'available'];

    stats['cpu'] = _.pick(cpu, cpuFields);
    stats['mem'] = _.pick(mem, memFields);
    stats['os'] = _.pick(os, osFields);
    const gpuAllStats = gpu['controllers'].find(item => Object.keys(item).length >= 1);
    stats['gpu'] = _.pick(gpuAllStats, gpuFields);
    const fsAllStats = fs.find(item => item.mount === '/');
    stats['fs'] = _.pick(fsAllStats, fsFields);

    // get cpu and load statistics from os-utils package
    stats['cpu']['freePercent'] = await getFreeCpuPercent();
    stats['cpu']['loadavg'] = {
        1: osUtils.loadavg(1),
        5: osUtils.loadavg(5),
        15: osUtils.loadavg(15)
    };
    return stats;
}
