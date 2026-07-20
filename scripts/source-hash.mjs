import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

/**
 * 서사 단계가 추가하는 제작자 일러스트는 게임 소스가 아니다. 해시에 넣으면
 * 서사 뒤에 검증 증거와 설계 검토가 통째로 무효가 되므로 제외한다.
 */
function isNarrativeAsset(path) {
    return /(^|[\\/])public[\\/]art[\\/]laika-[^\\/]*$/.test(path.split(sep).join('/'))
}

/**
 * 게임 소스의 해시. smoke, viewport, 설계 검토가 같은 값을 계산해야
 * "증거가 이 소스에서 나왔는가"를 서로 대조할 수 있다.
 */
export function sourceHash(root = '.') {
    const files = []
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name)
            if (entry.isDirectory()) walk(full)
            else if (entry.isFile()) files.push(full)
        }
    }
    for (const dir of ['src', 'public']) if (existsSync(join(root, dir))) walk(join(root, dir))
    for (const file of ['index.html', 'package.json', 'vite.config.ts']) if (existsSync(join(root, file))) files.push(join(root, file))
    const hash = createHash('sha256')
    for (const file of files.filter((path) => !isNarrativeAsset(path)).sort()) {
        hash.update(file)
        hash.update('\n')
        hash.update(readFileSync(file))
        hash.update('\n')
    }
    return hash.digest('hex')
}
