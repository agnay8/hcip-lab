const fs = require('fs');
const h = fs.readFileSync('D:/huaweinet/hcip-lab/index.html', 'utf8');
const core = /<script id="vrp-core">([\s\S]*?)<\/script>/.exec(h)[1];
const VRP = new Function(core + ';return VRP;')();

const lib = VRP.enumerate();
const byView = {};
lib.forEach(x => (byView[x.view] = byView[x.view] || []).push(x.syntax));

const out = [];
out.push('总命令数: ' + lib.length + '，视图数: ' + Object.keys(VRP.VIEWS).length);
out.push('总 SPEC 条目: ' + VRP.SPEC.length);
out.push('');
Object.keys(VRP.VIEWS).forEach(v => {
  const n = (byView[v] || []).length;
  out.push(String(n).padStart(4) + '  ' + v.padEnd(11) + VRP.VIEWS[v].name);
});
out.push('');

// 覆盖度体检：这些是 VRP/HCIP 的主要功能域
const DOMAINS = [
  ['IPv6 基础', /ipv6/i],
  ['OSPFv3', /ospfv3/i],
  ['BGP IPv6 地址族', /ipv6-family/i],
  ['DHCPv6 / ND / RA', /dhcpv6|\bnd\b|ra\b/i],
  ['QoS（流分类/流行为/流策略）', /traffic classifier|traffic behavior|traffic policy|qos /i],
  ['PPP / PPPoE', /ppp|pppoe|dialer/i],
  ['HDLC / Serial', /hdlc|serial/i],
  ['子接口 / VLANIF / Tunnel', /sub-interface|vlanif|tunnel|gre/i],
  ['VXLAN', /vxlan|vni/i],
  ['Super VLAN / MUX VLAN / QinQ', /super-vlan|mux-vlan|qinq|dot1q/i],
  ['MAC VLAN / 端口组', /mac-vlan|port-group/i],
  ['Voice VLAN', /voice/i],
  ['Smart Link / RRPP / ERPS / SEP', /smart-link|rrpp|erps|sep\b/i],
  ['BFD', /\bbfd\b/i],
  ['VRRP', /vrrp/i],
  ['NAT', /nat /i],
  ['MPLS / LDP / TE', /mpls|ldp|static-lsp/i],
  ['组播（IGMP/PIM/MSDP/MBGP）', /igmp|pim|msdp|multicast/i],
  ['RIP / RIPng', /\brip\b/i],
  ['策略路由 PBR', /policy-based-route/i],
  ['路由策略（route-policy/ip-prefix/as-path/community）', /route-policy|ip-prefix|as-path|community/i],
  ['文件系统（dir/copy/delete/startup）', /\bdir\b|\bcopy\b|\bdelete\b|startup/i],
  ['SNMP v3 / NTP 认证 / SFTP / SCP', /snmp-agent usm-user|ntp-service authentication|sftp|scp/i],
  ['堆叠 / 集群', /stack|css\b/i],
  ['防火墙 / ASPF / 攻击防范', /firewall|aspf|anti-attack/i],
  ['AAA / RADIUS / HWTACACS', /radius|hwtacacs|domain/i]
];

out.push('功能域覆盖体检（关键字命中）');
out.push('状态   命中数  功能域');
DOMAINS.forEach(([name, re]) => {
  const hits = lib.filter(x => re.test(x.syntax)).length;
  const flag = hits === 0 ? '缺失' : (hits < 4 ? '偏少' : '覆盖');
  out.push(flag.padEnd(5) + String(hits).padStart(5) + '   ' + name);
});

fs.writeFileSync('C:/Users/agnay/AppData/Local/Temp/audit.txt', out.join('\n'), 'utf8');
console.log(out.join('\n'));
