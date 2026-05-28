from manim import *
import numpy as np

# ── Brand colours ──────────────────────────────────────────
BG      = "#0F1117"
GREEN   = "#58CC02"
BLUE    = "#1CB0F6"
PURPLE  = "#CE82FF"
YELLOW  = "#FFD900"
ORANGE  = "#FF9600"
RED     = "#FF4B4B"
GRAY_   = "#2A2F4A"
SUBTEXT = "#8888BB"

config.background_color = BG


# ═══════════════════════════════════════════════════════════
# SCENE 1 — Title
# ═══════════════════════════════════════════════════════════
class S1_Title(Scene):
    def construct(self):
        title = Text("RELATIVE MOTION", font_size=72, weight=BOLD, color=WHITE,
                     font="Sans")
        sub   = Text("From the Observer's Paradox to JEE", font_size=28,
                     color=BLUE, font="Sans")
        credit= Text("Built with Manim · 3Blue1Brown style", font_size=18,
                     color=SUBTEXT, font="Sans")

        group = VGroup(title, sub, credit).arrange(DOWN, buff=0.45)

        # animated underline
        line = Line(LEFT*3.2, RIGHT*3.2, color=GREEN, stroke_width=4)
        line.next_to(title, DOWN, buff=0.1)

        self.play(Write(title, run_time=1.4))
        self.play(Create(line), FadeIn(sub, shift=UP*0.3, run_time=0.8))
        self.play(FadeIn(credit, run_time=0.6))
        self.wait(1.5)
        self.play(FadeOut(group), FadeOut(line))


# ═══════════════════════════════════════════════════════════
# SCENE 2 — The Observer's Paradox
# ═══════════════════════════════════════════════════════════
class S2_ObserverParadox(Scene):
    def construct(self):
        # ── Question ──────────────────────────────────────
        q = Text("Is the bear moving?", font_size=48, weight=BOLD,
                 color=YELLOW, font="Sans")
        self.play(Write(q)); self.wait(0.8)
        self.play(q.animate.scale(0.55).to_edge(UP, buff=0.3))

        # ── Tracks ────────────────────────────────────────
        track_top = Line(LEFT*7, RIGHT*7, color=GRAY_D, stroke_width=3).shift(DOWN*0.3)
        track_bot = Line(LEFT*7, RIGHT*7, color=GRAY_D, stroke_width=3).shift(DOWN*0.6)
        ties = VGroup(*[
            Line(UP*0.15, DOWN*0.15, color=GRAY_D, stroke_width=5).shift(
                LEFT*6 + RIGHT*i*0.7 + DOWN*0.45)
            for i in range(21)
        ])
        self.play(Create(track_top), Create(track_bot), Create(ties))

        # ── Train body ────────────────────────────────────
        train_body = Rectangle(width=3.6, height=1.0,
                               color=BLUE, fill_opacity=0.85,
                               stroke_width=2)
        train_body.shift(LEFT*5 + UP*0.15)

        windows = VGroup(*[
            Rectangle(width=0.55, height=0.38,
                      color=WHITE, fill_opacity=0.45,
                      stroke_width=1).shift(LEFT*5 + LEFT*1.1 + UP*0.2 + RIGHT*i*0.8)
            for i in range(4)
        ])

        # ── Bear (stick figure on train) ──────────────────
        bear_head  = Circle(radius=0.18, color=ORANGE, fill_opacity=0.9, stroke_width=2)
        bear_body  = Line(DOWN*0, DOWN*0.45, color=ORANGE, stroke_width=3)
        bear_arms  = Line(LEFT*0.25+DOWN*0.15, RIGHT*0.25+DOWN*0.15, color=ORANGE, stroke_width=3)
        bear_leg_l = Line(DOWN*0.45, LEFT*0.2+DOWN*0.75, color=ORANGE, stroke_width=3)
        bear_leg_r = Line(DOWN*0.45, RIGHT*0.2+DOWN*0.75, color=ORANGE, stroke_width=3)
        bear = VGroup(bear_head, bear_body, bear_arms, bear_leg_l, bear_leg_r)
        bear.shift(LEFT*5 + UP*0.55)

        train = VGroup(train_body, windows, bear)

        # ── Platform person ───────────────────────────────
        pp_head  = Circle(radius=0.18, color=GREEN, fill_opacity=0.9, stroke_width=2)
        pp_body  = Line(ORIGIN, DOWN*0.5, color=GREEN, stroke_width=3)
        pp_arms  = Line(LEFT*0.25+DOWN*0.15, RIGHT*0.25+DOWN*0.15, color=GREEN, stroke_width=3)
        pp_leg_l = Line(DOWN*0.5, LEFT*0.18+DOWN*0.8, color=GREEN, stroke_width=3)
        pp_leg_r = Line(DOWN*0.5, RIGHT*0.18+DOWN*0.8, color=GREEN, stroke_width=3)
        platform_person = VGroup(pp_head, pp_body, pp_arms, pp_leg_l, pp_leg_r)
        platform_person.shift(RIGHT*3 + DOWN*0.6)

        # Platform
        platform = Rectangle(width=2.5, height=0.3,
                              color=GRAY_C, fill_opacity=0.6).shift(RIGHT*3 + DOWN*1.25)

        label_pp  = Text("Platform observer", font_size=18, color=GREEN, font="Sans")
        label_pp.next_to(platform_person, DOWN, buff=1.0)
        label_bear= Text("Bear on train", font_size=18, color=ORANGE, font="Sans")
        label_bear.next_to(bear, UP, buff=0.15)

        self.play(
            Create(platform),
            FadeIn(platform_person, run_time=0.6),
            FadeIn(label_pp, run_time=0.6)
        )
        self.play(FadeIn(train), FadeIn(label_bear))
        self.wait(0.5)

        # ── Train moves right ─────────────────────────────
        self.play(
            train.animate.shift(RIGHT*10),
            label_bear.animate.shift(RIGHT*10),
            run_time=3, rate_func=linear
        )
        self.wait(0.4)

        # ── Split-screen labels ───────────────────────────
        left_box = Rectangle(width=5.5, height=2.5, color=ORANGE,
                             stroke_width=2, fill_opacity=0.05).shift(LEFT*3.2 + UP*0.5)
        right_box= Rectangle(width=5.5, height=2.5, color=GREEN,
                             stroke_width=2, fill_opacity=0.05).shift(RIGHT*3.2 + UP*0.5)

        l_title = Text("BEAR's view", font_size=22, color=ORANGE, weight=BOLD,
                       font="Sans").shift(LEFT*3.2 + UP*1.5)
        r_title = Text("PLATFORM's view", font_size=22, color=GREEN, weight=BOLD,
                       font="Sans").shift(RIGHT*3.2 + UP*1.5)

        l_text = Text("I am STILL.\nThe platform\nrushes backward →",
                      font_size=20, color=WHITE, font="Sans",
                      line_spacing=1.4).shift(LEFT*3.2 + UP*0.3)
        r_text = Text("The train is MOVING.\nThe bear zooms past.\nI am STILL.",
                      font_size=20, color=WHITE, font="Sans",
                      line_spacing=1.4).shift(RIGHT*3.2 + UP*0.3)

        self.play(Create(left_box), Create(right_box))
        self.play(Write(l_title), Write(r_title))
        self.play(FadeIn(l_text, shift=RIGHT*0.2), FadeIn(r_text, shift=LEFT*0.2))
        self.wait(1.5)

        # ── Insight ───────────────────────────────────────
        insight = Text("Both are CORRECT.\nMotion is relative to the observer.",
                       font_size=30, color=YELLOW, weight=BOLD, font="Sans",
                       line_spacing=1.3)
        insight_box = SurroundingRectangle(insight, color=YELLOW,
                                           buff=0.3, corner_radius=0.15)

        self.play(FadeOut(left_box), FadeOut(right_box),
                  FadeOut(l_title), FadeOut(r_title),
                  FadeOut(l_text), FadeOut(r_text),
                  FadeOut(platform_person), FadeOut(label_pp),
                  FadeOut(platform), FadeOut(track_top),
                  FadeOut(track_bot), FadeOut(ties))
        self.play(Write(insight), Create(insight_box))
        self.wait(2)
        self.play(FadeOut(insight), FadeOut(insight_box), FadeOut(q))


# ═══════════════════════════════════════════════════════════
# SCENE 3 — Relative Velocity in 1D
# ═══════════════════════════════════════════════════════════
class S3_RelativeVelocity1D(Scene):
    def construct(self):
        title = Text("1D Relative Velocity", font_size=40, weight=BOLD,
                     color=GREEN, font="Sans").to_edge(UP, buff=0.4)
        self.play(Write(title))

        # ── Road ──────────────────────────────────────────
        road = Rectangle(width=14, height=1.1, color=GRAY_D,
                         fill_opacity=0.8).shift(DOWN*0.8)
        dash = DashedLine(LEFT*7, RIGHT*7, color=YELLOW,
                          dash_length=0.4, dashed_ratio=0.5,
                          stroke_width=2).shift(DOWN*0.8)
        self.play(FadeIn(road), Create(dash))

        # ── Two cars ──────────────────────────────────────
        def make_car(color_, label_str, speed_str, side=1):
            body = Rectangle(width=1.2, height=0.5, color=color_,
                             fill_opacity=0.9, stroke_width=2)
            roof = Rectangle(width=0.7, height=0.3, color=color_,
                             fill_opacity=0.9, stroke_width=2).shift(UP*0.35)
            w1 = Circle(radius=0.12, color=GRAY_E,
                        fill_opacity=1, stroke_width=1).shift(LEFT*0.35+DOWN*0.3)
            w2 = Circle(radius=0.12, color=GRAY_E,
                        fill_opacity=1, stroke_width=1).shift(RIGHT*0.35+DOWN*0.3)
            lbl= Text(label_str, font_size=18, color=WHITE,
                      font="Sans").next_to(body, UP, buff=0.55)
            spd= Text(speed_str, font_size=20, color=color_,
                      weight=BOLD, font="Sans").next_to(body, UP, buff=0.05)
            return VGroup(body, roof, w1, w2), lbl, spd

        car_a, lbl_a, spd_a = make_car(BLUE,   "Car A", "80 km/h →")
        car_b, lbl_b, spd_b = make_car(RED,    "Car B", "60 km/h →")

        car_a.shift(LEFT*4 + DOWN*0.5)
        lbl_a.shift(LEFT*4 + DOWN*0.1)
        spd_a.shift(LEFT*4 + DOWN*0.15)

        car_b.shift(LEFT*1 + DOWN*0.5)
        lbl_b.shift(LEFT*1 + DOWN*0.1)
        spd_b.shift(LEFT*1 + DOWN*0.15)

        self.play(FadeIn(car_a), FadeIn(lbl_a), FadeIn(spd_a),
                  FadeIn(car_b), FadeIn(lbl_b), FadeIn(spd_b))
        self.wait(0.5)

        # ── Animate same direction ─────────────────────────
        self.play(
            car_a.animate.shift(RIGHT*3.5),
            lbl_a.animate.shift(RIGHT*3.5),
            spd_a.animate.shift(RIGHT*3.5),
            car_b.animate.shift(RIGHT*2.0),
            lbl_b.animate.shift(RIGHT*2.0),
            spd_b.animate.shift(RIGHT*2.0),
            run_time=2.5, rate_func=linear
        )

        # ── Formula reveal ────────────────────────────────
        formula1 = MathTex(
            r"V_{A/B} = V_A - V_B = 80 - 60 = 20\text{ km/h}",
            font_size=38, color=WHITE
        ).shift(UP*2.3)
        box1 = SurroundingRectangle(formula1, color=GREEN, buff=0.2, corner_radius=0.1)

        label_rel = Text("From A's view, B moves at 20 km/h backward",
                         font_size=22, color=SUBTEXT, font="Sans").shift(UP*1.6)

        self.play(Write(formula1), Create(box1))
        self.play(FadeIn(label_rel))
        self.wait(1.2)

        # ── Opposite direction ────────────────────────────
        self.play(FadeOut(formula1), FadeOut(box1), FadeOut(label_rel),
                  FadeOut(lbl_a), FadeOut(spd_a),
                  FadeOut(lbl_b), FadeOut(spd_b))

        # Reset cars
        car_a2 = car_a.copy().shift(LEFT*8).set_color(BLUE)
        car_b2 = car_b.copy().shift(RIGHT*5).set_color(RED)
        spd_a2 = Text("60 km/h →", font_size=20, color=BLUE, weight=BOLD,
                      font="Sans").next_to(car_a2, UP, buff=0.1)
        spd_b2 = Text("← 40 km/h", font_size=20, color=RED, weight=BOLD,
                      font="Sans").next_to(car_b2, UP, buff=0.1)

        self.play(FadeIn(car_a2), FadeIn(car_b2),
                  FadeIn(spd_a2), FadeIn(spd_b2))

        # Head-on
        self.play(
            car_a2.animate.shift(RIGHT*5.5),
            spd_a2.animate.shift(RIGHT*5.5),
            car_b2.animate.shift(LEFT*5.5),
            spd_b2.animate.shift(LEFT*5.5),
            run_time=2.2, rate_func=linear
        )

        bang = Text("💥", font_size=72).shift(DOWN*0.5)
        self.play(FadeIn(bang, scale=0.1))
        self.wait(0.3)

        formula2 = MathTex(
            r"V_{\text{relative}} = V_A + V_B = 60 + 40 = 100\text{ km/h}",
            font_size=36, color=WHITE
        ).shift(UP*2.3)
        box2 = SurroundingRectangle(formula2, color=RED, buff=0.2, corner_radius=0.1)
        rule = Text("Opposite directions → ADD the speeds", font_size=24,
                    color=ORANGE, weight=BOLD, font="Sans").shift(UP*1.6)

        self.play(Write(formula2), Create(box2), FadeIn(rule))
        self.wait(1.5)
        self.play(*[FadeOut(m) for m in self.mobjects])


# ═══════════════════════════════════════════════════════════
# SCENE 4 — 2D River Crossing
# ═══════════════════════════════════════════════════════════
class S4_RiverCrossing(Scene):
    def construct(self):
        title = Text("2D Relative Velocity — River Crossing",
                     font_size=36, weight=BOLD, color=PURPLE, font="Sans")
        title.to_edge(UP, buff=0.3)
        self.play(Write(title))

        # ── Draw river ────────────────────────────────────
        bank_top = Rectangle(width=14, height=1.2, color="#2E7D32",
                             fill_opacity=0.85).shift(UP*2.5)
        bank_bot = Rectangle(width=14, height=1.2, color="#2E7D32",
                             fill_opacity=0.85).shift(DOWN*2.5)
        river    = Rectangle(width=14, height=3.3, color="#0D47A1",
                             fill_opacity=0.6)

        label_top = Text("North Bank (destination)", font_size=18,
                         color=WHITE, font="Sans").shift(UP*2.5)
        label_bot = Text("South Bank (start)", font_size=18,
                         color=WHITE, font="Sans").shift(DOWN*2.5)

        self.play(FadeIn(river), FadeIn(bank_top), FadeIn(bank_bot),
                  FadeIn(label_top), FadeIn(label_bot))

        # ── Current arrows ────────────────────────────────
        curr_arrows = VGroup(*[
            Arrow(LEFT*0.0, RIGHT*1.4, color=BLUE, stroke_width=2,
                  tip_length=0.18).shift(LEFT*5 + RIGHT*i*2.0 + UP*j*1.0)
            for i in range(7) for j in range(-1, 2)
        ])
        curr_label = Text("River current: 4 m/s →", font_size=20,
                          color=BLUE, font="Sans").shift(LEFT*4 + DOWN*1.8)
        self.play(Create(curr_arrows), FadeIn(curr_label))
        self.wait(0.4)

        # ── Swimmer (dot) and vectors ──────────────────────
        start = DOWN*1.9 + LEFT*2.5
        swimmer = Dot(radius=0.18, color=ORANGE).move_to(start)
        swim_label = Text("Swimmer", font_size=18,
                          color=ORANGE, font="Sans").next_to(swimmer, LEFT, buff=0.2)

        # Swim vector (north)
        v_swim = Arrow(ORIGIN, UP*1.6, color=GREEN,
                       stroke_width=5, tip_length=0.22)
        v_swim.put_start_and_end_on(start, start + UP*1.6)
        swim_text = MathTex(r"v_s = 3\text{ m/s } \uparrow",
                            font_size=26, color=GREEN).next_to(v_swim, LEFT, buff=0.1)

        # River vector (east)
        v_river = Arrow(ORIGIN, RIGHT*2.1, color=BLUE,
                        stroke_width=5, tip_length=0.22)
        v_river.put_start_and_end_on(start, start + RIGHT*2.1)
        river_text = MathTex(r"v_r = 4\text{ m/s } \rightarrow",
                             font_size=26, color=BLUE).next_to(v_river, DOWN, buff=0.1)

        self.play(FadeIn(swimmer), FadeIn(swim_label))
        self.play(Create(v_swim), Write(swim_text))
        self.play(Create(v_river), Write(river_text))
        self.wait(0.6)

        # ── Resultant vector ──────────────────────────────
        resultant_end = start + UP*1.6 + RIGHT*2.1
        v_result = Arrow(start, resultant_end, color=YELLOW,
                         stroke_width=5, tip_length=0.25)
        res_text = MathTex(
            r"v_{actual} = \sqrt{3^2+4^2} = 5\text{ m/s}",
            font_size=26, color=YELLOW
        ).next_to(v_result, RIGHT, buff=0.15)

        self.play(Create(v_result), Write(res_text))
        self.wait(0.5)

        # ── Swimmer actual path ────────────────────────────
        path_points = [
            start + t*(UP*3.8 + RIGHT*5.1)
            for t in np.linspace(0, 1, 60)
        ]
        actual_path = VMobject(color=YELLOW, stroke_width=3, stroke_opacity=0.6)
        actual_path.set_points_smoothly(path_points)

        self.play(
            MoveAlongPath(swimmer, actual_path),
            Create(actual_path),
            run_time=3, rate_func=linear
        )
        self.wait(0.4)

        # ── Drift annotation ──────────────────────────────
        drift_end = start + UP*3.8 + RIGHT*5.1
        drift_line = DashedLine(start + UP*3.8, drift_end, color=RED, stroke_width=2)
        drift_text = Text("Drift = 5.1 m →", font_size=18,
                          color=RED, font="Sans").next_to(drift_line, DOWN, buff=0.1)

        self.play(Create(drift_line), FadeIn(drift_text))
        self.wait(1.0)

        # ── Insight box ───────────────────────────────────
        insight = MathTex(
            r"\text{Minimum TIME} \Rightarrow \text{aim straight across} \Rightarrow t = \frac{d}{v_s}",
            font_size=30, color=WHITE
        ).shift(DOWN*3.6)
        ibox = SurroundingRectangle(insight, color=PURPLE, buff=0.25, corner_radius=0.12)

        self.play(Write(insight), Create(ibox))
        self.wait(1.8)
        self.play(*[FadeOut(m) for m in self.mobjects])


# ═══════════════════════════════════════════════════════════
# SCENE 5 — JEE Formula Summary
# ═══════════════════════════════════════════════════════════
class S5_Summary(Scene):
    def construct(self):
        title = Text("JEE Formula Sheet", font_size=46, weight=BOLD,
                     color=YELLOW, font="Sans").to_edge(UP, buff=0.35)
        line  = Line(LEFT*4.5, RIGHT*4.5, color=YELLOW,
                     stroke_width=3).next_to(title, DOWN, buff=0.1)
        self.play(Write(title), Create(line))

        formulas = [
            (GREEN,  r"V_{A/B} = V_A - V_B \quad \text{(same direction)}"),
            (RED,    r"V_{A/B} = V_A + V_B \quad \text{(opposite direction)}"),
            (BLUE,   r"t_{min} = \frac{d}{v_s} \quad \text{(aim straight across)}"),
            (PURPLE, r"\text{Drift} = v_r \cdot \frac{d}{v_s}"),
            (ORANGE, r"\sin\theta = \frac{v_r}{v_s} \quad \text{(straight path condition)}"),
            (YELLOW, r"a_{relative} = 0 \quad \text{(both in free fall)}"),
        ]

        rows = VGroup()
        for color_, tex in formulas:
            dot  = Dot(radius=0.09, color=color_)
            eq   = MathTex(tex, font_size=28, color=WHITE)
            eq.set_color_by_tex_to_color_map({tex: color_})
            row  = VGroup(dot, eq).arrange(RIGHT, buff=0.3)
            rows.add(row)

        rows.arrange(DOWN, buff=0.38, aligned_edge=LEFT)
        rows.next_to(line, DOWN, buff=0.4).shift(LEFT*0.5)

        for row in rows:
            self.play(FadeIn(row, shift=RIGHT*0.3, run_time=0.45))

        self.wait(1.0)

        # ── Real JEE callout ──────────────────────────────
        jee = Text("✓  JEE Mains 2019: tanθ = v_walk / v_rain",
                   font_size=22, color=GREEN, font="Sans")
        jee2= Text("✓  JEE Advanced 2020: t = d / v_s = 40/5 = 8 s",
                   font_size=22, color=GREEN, font="Sans")
        jee_group = VGroup(jee, jee2).arrange(DOWN, buff=0.2, aligned_edge=LEFT)
        jee_box   = SurroundingRectangle(jee_group, color=GREEN,
                                          buff=0.25, corner_radius=0.12)
        jee_group.to_edge(DOWN, buff=0.55)
        jee_box.surround(jee_group, buff=0.25)

        self.play(Create(jee_box), Write(jee), Write(jee2))
        self.wait(2.0)

        # ── Outro ─────────────────────────────────────────
        self.play(*[FadeOut(m) for m in self.mobjects])

        outro = Text("You just built Relative Motion\nfrom first principles. 🐻",
                     font_size=44, weight=BOLD, color=WHITE, font="Sans",
                     line_spacing=1.4)
        sub   = Text("Now solve any JEE question.", font_size=28,
                     color=GREEN, font="Sans")
        VGroup(outro, sub).arrange(DOWN, buff=0.5)

        self.play(Write(outro))
        self.play(FadeIn(sub, shift=UP*0.2))
        self.wait(2.5)
        self.play(FadeOut(outro), FadeOut(sub))


# ═══════════════════════════════════════════════════════════
# FULL FILM — chain all scenes
# ═══════════════════════════════════════════════════════════
class RelativeMotionFull(Scene):
    def construct(self):
        for SceneClass in [S1_Title, S2_ObserverParadox,
                           S3_RelativeVelocity1D, S4_RiverCrossing,
                           S5_Summary]:
            SceneClass.construct(self)
