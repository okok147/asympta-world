import UIKit

enum WorldCircleInkStyle: String, CaseIterable {
    case clay, saffron, tide, dusk

    var color: UInt32 {
        switch self {
        case .clay: return 0xbb6346
        case .saffron: return 0xd39235
        case .tide: return 0x4f8299
        case .dusk: return 0x8978a6
        }
    }

    var name: WorldStrings.Key {
        switch self {
        case .clay: return .circleInkClay
        case .saffron: return .circleInkSaffron
        case .tide: return .circleInkTide
        case .dusk: return .circleInkDusk
        }
    }

    var note: WorldStrings.Key {
        switch self {
        case .clay: return .circleInkClayNote
        case .saffron: return .circleInkSaffronNote
        case .tide: return .circleInkTideNote
        case .dusk: return .circleInkDuskNote
        }
    }
}

/// The seal stays decorative. The member name beside it is the shared identity.
final class WorldCircleSeal: UIView {
    private let style: WorldCircleInkStyle?
    private let tint: UIColor
    private let wash: UIImage

    init(ink: UInt32, style: WorldCircleInkStyle? = nil) {
        self.style = style
        let pigment = style?.color ?? ink
        tint = UIColor(hex:pigment)
        wash = WorldPigment.placeImage(pigment)
        super.init(frame:.zero)
        isAccessibilityElement = false
        isOpaque = false
        isUserInteractionEnabled = false
        contentMode = .redraw
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        let diameter = min(bounds.width,bounds.height)
        guard diameter > 0 else { return }
        let square = CGRect(x:bounds.midX-diameter/2,y:bounds.midY-diameter/2,width:diameter,height:diameter)
        wash.draw(in:square)
        context.saveGState()
        context.translateBy(x:bounds.midX,y:bounds.midY)
        context.scaleBy(x:diameter/80,y:diameter/80)
        context.setLineCap(.round)
        context.setLineWidth(0.7)
        context.setStrokeColor(tint.withAlphaComponent(0.80).cgColor)

        switch style {
        case .clay:
            // Thumb-cut channels spread from the center of a fired clay stamp.
            for index in -4...4 {
                let y = CGFloat(index)*4
                context.move(to:CGPoint(x:-17+abs(y)*0.22,y:y))
                context.addQuadCurve(to:CGPoint(x:17-abs(y)*0.22,y:y-1),
                                     control:CGPoint(x:3,y:y+6))
                context.strokePath()
            }
            ring(in:context,radius:23,from:0.2,to:6.1)
        case .saffron:
            // A tiny engraved sun, with staggered ray lengths like a letterpress mark.
            ring(in:context,radius:9,from:0,to:.pi*2)
            for index in 0..<24 {
                let angle = CGFloat(index) * .pi / 12
                let outer: CGFloat = index.isMultiple(of:3) ? 24 : 19
                context.move(to:CGPoint(x:cos(angle)*12,y:sin(angle)*12))
                context.addLine(to:CGPoint(x:cos(angle)*outer,y:sin(angle)*outer))
                context.strokePath()
            }
        case .tide:
            let edge = CGPath(ellipseIn:CGRect(x:-22,y:-22,width:44,height:44),transform:nil)
            context.saveGState()
            context.addPath(edge)
            context.clip()
            for index in -4...4 {
                let y = CGFloat(index)*5
                context.move(to:CGPoint(x:-24,y:y+3))
                context.addCurve(to:CGPoint(x:24,y:y-3),control1:CGPoint(x:-8,y:y-13),control2:CGPoint(x:8,y:y+13))
                context.strokePath()
            }
            context.restoreGState()
            context.addPath(edge)
            context.strokePath()
        case .dusk:
            context.move(to:CGPoint(x:9,y:-20))
            context.addCurve(to:CGPoint(x:9,y:18),control1:CGPoint(x:-30,y:-23),control2:CGPoint(x:-29,y:24))
            context.addCurve(to:CGPoint(x:9,y:-20),control1:CGPoint(x:-14,y:6),control2:CGPoint(x:-11,y:-10))
            context.strokePath()
            star(in:context,x:11,y:-4,radius:6)
            star(in:context,x:22,y:8,radius:3)
        case nil:
            for index in 0..<3 {
                let angle = CGFloat(index)*0.8
                ring(in:context,radius:16+CGFloat(index)*4,from:angle,to:angle+5.05)
            }
            context.setFillColor(WorldTheme.ink.cgColor)
            context.fillEllipse(in:CGRect(x:-1.5,y:-1.5,width:3,height:3))
        }
        context.restoreGState()
    }

    private func ring(in context: CGContext, radius: CGFloat, from: CGFloat, to: CGFloat) {
        context.addArc(center:.zero,radius:radius,startAngle:from,endAngle:to,clockwise:false)
        context.strokePath()
    }

    private func star(in context: CGContext, x: CGFloat, y: CGFloat, radius: CGFloat) {
        context.move(to:CGPoint(x:x-radius,y:y))
        context.addLine(to:CGPoint(x:x+radius,y:y))
        context.move(to:CGPoint(x:x,y:y-radius))
        context.addLine(to:CGPoint(x:x,y:y+radius))
        context.strokePath()
    }
}
