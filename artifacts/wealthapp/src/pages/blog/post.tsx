import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import PublicNav from "@/components/PublicNav";
import { apiFetch } from "@/lib/api";
import { Calendar, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlogPost { id: string; title: string; slug: string; excerpt: string | null; category: string | null; contentMarkdown: string | null; coverImageUrl: string | null; publishedAt: string | null; }

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: ["blog", slug],
    queryFn: () => apiFetch<BlogPost>(`/blog/${slug}`),
    enabled: !!slug,
  });

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    </div>
  );

  if (!post) return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
        <Link href="/blog"><Button>Back to Blog</Button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <article className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/blog">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />Back to Insights
          </a>
        </Link>
        {post.category && <div className="text-xs font-medium text-primary uppercase tracking-wide mb-3">{post.category}</div>}
        <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">{post.title}</h1>
        {post.publishedAt && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-8">
            <Calendar className="h-4 w-4" />
            {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
        )}
        {post.coverImageUrl && <img src={post.coverImageUrl} alt={post.title} className="w-full rounded-xl mb-8 object-cover h-64" />}
        {post.contentMarkdown ? (
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {post.contentMarkdown.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mt-8 mb-3">{line.slice(3)}</h2>;
              if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold mt-6 mb-2">{line.slice(4)}</h3>;
              if (line.startsWith("- ")) return <li key={i} className="ml-4 text-muted-foreground">{line.slice(2)}</li>;
              if (line.trim() === "") return <br key={i} />;
              return <p key={i} className="text-muted-foreground leading-relaxed mb-3">{line}</p>;
            })}
          </div>
        ) : (
          post.excerpt && <p className="text-muted-foreground text-lg leading-relaxed">{post.excerpt}</p>
        )}
        <div className="mt-12 bg-gradient-to-br from-[#042C53] to-[#0a4a7a] rounded-xl p-6 text-white text-center">
          <h3 className="font-bold mb-2">Build Your Financial Plan</h3>
          <p className="text-white/70 text-sm mb-4">Apply these insights with our free financial planning tools.</p>
          <Link href="/sign-up"><Button className="bg-[#1D9E75] hover:bg-[#178a65] border-0">Get Started Free</Button></Link>
        </div>
      </article>
    </div>
  );
}
