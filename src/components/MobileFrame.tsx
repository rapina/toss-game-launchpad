import { Children, ReactNode, isValidElement } from 'react'
import AdBanner from './AdBanner'

interface Props {
    children: ReactNode
}

/**
 * Constrains app to 9:16 portrait aspect ratio.
 * Layout: content (flex:1) + ad banner (flex-shrink:0) at bottom.
 */
export default function MobileFrame({ children }: Props) {
    const content: ReactNode[] = []
    let banner: ReactNode = null

    Children.forEach(children, (child) => {
        if (isValidElement(child) && child.type === AdBanner) {
            banner = child
        } else {
            content.push(child)
        }
    })

    return (
        <div className="mobile-frame-outer">
            <div className="mobile-frame-inner">
                <div className="mobile-frame-content">
                    {content}
                </div>
                {banner}
            </div>
        </div>
    )
}
